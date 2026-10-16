import {
  flagsAfterEvents,
  noFlags,
  toggleFlag,
  type Color,
  type EventView,
  type Flags,
  type GameSettings,
  type Move,
  type Square,
} from "@chessweeper/engine";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { GameOverWithOwned, PlacementView } from "../components/placementTypes";
import { OnlineClient, type ClientEvent, type ConnectionState } from "./client";
import { serverUrl } from "./config";
import { FATAL_MESSAGES, friendlyError, type FatalReason } from "./errors";
import { flagsAfterSnapshot } from "./flags";
import { browserSocket } from "./socket";
import { gameOverFromWire, settingsFromWire, splitEvents, viewFromWire } from "./wire";
import {
  clearGame,
  loadCurrent,
  loadFlags,
  loadSeat,
  saveCurrent,
  saveFlags,
  saveSeat,
} from "./storage";

export type OpponentState = "unknown" | "connected" | "disconnected" | "claimable";
/** `theirs`: the opponent offered and I may answer. `mine`: my offer is pending. */
export type DrawState = "none" | "theirs" | "mine";
export type OnlinePhase = "lobby" | "connecting" | "waiting" | "playing" | "over";

export interface OnlineNotice {
  readonly id: number;
  readonly text: string;
}

interface State {
  readonly active: boolean;
  readonly code: string | null;
  /** The game's settings, known from `joined` (before the first snapshot). */
  readonly settings: GameSettings | null;
  readonly seat: Color | null;
  readonly view: PlacementView | null;
  readonly gameOver: GameOverWithOwned | null;
  readonly flags: Flags;
  /** How much of the move log the flags have seen; null before a game is joined. */
  readonly flagsLogLength: number | null;
  readonly lastEvents: readonly EventView[];
  readonly turnId: number;
  readonly connection: ConnectionState;
  readonly opponent: OpponentState;
  readonly draw: DrawState;
  /** I offered a draw and have not moved since (3.6). */
  readonly mustMove: boolean;
  /** A move is on its way to the server and unanswered. */
  readonly pending: boolean;
  readonly error: OnlineNotice | null;
  readonly fatal: FatalReason | null;
  /** Why the last create or join failed, shown in the lobby. */
  readonly lobbyError: string | null;
  readonly noticeCounter: number;
  /**
   * Manual mine mode (3.10): when the placement round ends, from the server's `placement`
   * message (`msLeft` at receipt). M-C-RECONCILE: relies on the server sending it at round
   * start and in every snapshot during a round.
   */
  readonly placementEndsAt: number | null;
  /** My placements as I made them, until the server's next view replaces them. */
  readonly ownOverride: readonly Square[] | null;
  /** I pressed Done and the server has not confirmed it in a view yet. */
  readonly doneSent: boolean;
  /** Mines the server placed at random for me when the last round ended (viewer-only event). */
  readonly autoPlaced: number | null;
}

const initial: State = {
  active: false,
  code: null,
  settings: null,
  seat: null,
  view: null,
  gameOver: null,
  flags: noFlags(),
  flagsLogLength: null,
  lastEvents: [],
  turnId: 0,
  connection: "closed",
  opponent: "unknown",
  draw: "none",
  mustMove: false,
  pending: false,
  error: null,
  fatal: null,
  lobbyError: null,
  noticeCounter: 0,
  placementEndsAt: null,
  ownOverride: null,
  doneSent: false,
  autoPlaced: null,
};

type Action =
  | { readonly t: "start"; readonly code: string | null }
  | { readonly t: "reset"; readonly lobbyError: string | null }
  | {
      readonly t: "joined";
      readonly code: string;
      readonly seat: Color;
      readonly settings: GameSettings;
      readonly stored: { readonly flags: Flags; readonly logLength: number } | null;
    }
  | { readonly t: "client"; readonly event: ClientEvent }
  | { readonly t: "flag"; readonly square: Square }
  | { readonly t: "pending" }
  | { readonly t: "own"; readonly own: readonly Square[] | null }
  | { readonly t: "done" }
  | { readonly t: "draw"; readonly draw: DrawState; readonly mustMove?: boolean }
  | { readonly t: "dismissError" }
  | { readonly t: "clearLobbyError" };

function notice(state: State, text: string): Pick<State, "error" | "noticeCounter"> {
  return {
    error: { id: state.noticeCounter + 1, text },
    noticeCounter: state.noticeCounter + 1,
  };
}

function onClientEvent(state: State, event: ClientEvent): State {
  switch (event.type) {
    case "connection":
      return { ...state, connection: event.state };
    case "joined":
      return state; // handled through the `joined` action, which carries stored flags
    case "snapshot": {
      const view = viewFromWire(event.view);
      return {
        ...state,
        view,
        lastEvents: [],
        pending: false,
        flags: flagsAfterSnapshot(state.flags, state.flagsLogLength, view),
        flagsLogLength: view.log.length,
        ownOverride: null,
        doneSent: false,
        placementEndsAt: view.phase.kind === "placement" ? state.placementEndsAt : null,
      };
    }
    case "update": {
      const view = viewFromWire(event.view);
      const split = splitEvents(event.events, state.seat);
      const moved = split.events.some((e) => e.type === "MoveMade");
      const mine = split.events.some((e) => e.type === "MoveMade" && e.color === state.seat);
      const newRound = split.events.some((e) => e.type === "PlacementStarted");
      return {
        ...state,
        view,
        lastEvents: split.events,
        turnId: state.turnId + 1,
        pending: false,
        // 3.6: any move lapses a pending offer; the offerer may offer again after moving.
        // Placement updates (a player got ready) are not moves.
        draw: moved ? "none" : state.draw,
        mustMove: mine ? false : state.mustMove,
        flags: flagsAfterEvents(state.flags, split.events),
        flagsLogLength: view.log.length,
        ownOverride: null,
        doneSent: false,
        placementEndsAt: view.phase.kind === "placement" ? state.placementEndsAt : null,
        // The random-fill notice stays until I move or the next round starts.
        autoPlaced: split.autoPlaced ?? (mine || newRound ? null : state.autoPlaced),
      };
    }
    case "placement":
      return { ...state, placementEndsAt: Date.now() + event.msLeft };
    case "game_over": {
      const over = gameOverFromWire(event.over);
      return { ...state, view: over.view, gameOver: over, pending: false };
    }
    case "opponent":
      return { ...state, opponent: event.state };
    case "draw":
      return { ...state, draw: event.state === "offered" ? "theirs" : "none" };
    case "error": {
      const text = friendlyError(event.code);
      if (state.seat === null) return { ...state, lobbyError: text, active: false };
      return {
        ...state,
        pending: false,
        ownOverride: null,
        doneSent: false,
        ...notice(state, text),
      };
    }
    case "fatal":
      if (state.seat === null) {
        return { ...initial, lobbyError: FATAL_MESSAGES[event.reason] };
      }
      return { ...state, fatal: event.reason, pending: false };
  }
}

function reducer(state: State, action: Action): State {
  switch (action.t) {
    case "start":
      return { ...initial, active: true, code: action.code, connection: "connecting" };
    case "reset":
      return { ...initial, lobbyError: action.lobbyError };
    case "joined":
      return {
        ...state,
        code: action.code,
        settings: action.settings,
        seat: action.seat,
        flags: action.stored?.flags ?? noFlags(),
        flagsLogLength: action.stored?.logLength ?? null,
      };
    case "client":
      return onClientEvent(state, action.event);
    case "flag":
      return { ...state, flags: toggleFlag(state.flags, action.square) };
    case "pending":
      return { ...state, pending: true };
    case "own":
      return { ...state, ownOverride: action.own };
    case "done":
      return { ...state, doneSent: true };
    case "draw":
      return {
        ...state,
        draw: action.draw,
        mustMove: action.mustMove ?? state.mustMove,
      };
    case "dismissError":
      return { ...state, error: null };
    case "clearLobbyError":
      return { ...state, lobbyError: null };
  }
}

export interface OnlineGame {
  /** A session exists: connecting, waiting, playing or over. */
  readonly active: boolean;
  readonly phase: OnlinePhase;
  readonly seat: Color | null;
  readonly code: string | null;
  readonly settings: GameSettings | null;
  /** The server's view with my own pending placement edits applied (3.10). */
  readonly view: PlacementView | null;
  readonly gameOver: GameOverWithOwned | null;
  readonly flags: Flags;
  readonly lastEvents: readonly EventView[];
  /** Increments per update from the server (a move or an ending); snapshots do not count. */
  readonly turnId: number;
  readonly connection: ConnectionState;
  readonly opponent: OpponentState;
  readonly draw: DrawState;
  readonly canOfferDraw: boolean;
  /** True while it is my turn and no move is awaiting an answer. */
  readonly canMove: boolean;
  /** Manual mine mode: milliseconds left in the placement round, null without a timer. */
  readonly placementMsLeft: number | null;
  /** Mines the server placed at random for me, until my next move (null if none). */
  readonly autoPlaced: number | null;
  readonly error: OnlineNotice | null;
  readonly fatal: FatalReason | null;
  readonly lobbyError: string | null;
  create: (settings?: GameSettings) => void;
  join: (code: string) => void;
  /** Forgets the game and returns to the lobby. */
  leave: () => void;
  play: (move: Move) => void;
  toggleFlag: (square: Square) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  claimWin: () => void;
  /** Manual mine mode: place or take back one of my mines. */
  togglePlacement: (square: Square) => void;
  donePlacement: () => void;
  dismissError: () => void;
  clearLobbyError: () => void;
}

export interface UseOnlineGameOptions {
  /** Injectable for tests. Returns null when online play is not configured. */
  readonly createClient?: () => OnlineClient | null;
  /** Rejoin the stored game on mount. Default true. */
  readonly resumeOnMount?: boolean;
}

function defaultCreateClient(): OnlineClient | null {
  const url = serverUrl();
  return url === null ? null : new OnlineClient({ url, createSocket: browserSocket });
}

export function useOnlineGame(options: UseOnlineGameOptions = {}): OnlineGame {
  const createClient = options.createClient ?? defaultCreateClient;
  const resumeOnMount = options.resumeOnMount ?? true;
  const [state, dispatch] = useReducer(reducer, initial);
  const clientRef = useRef<OnlineClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const codeRef = useRef<string | null>(null);
  /** True once the current client has been given a seat. */
  const joinedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [, setTick] = useState(0);

  const stop = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    clientRef.current?.close();
    clientRef.current = null;
  }, []);

  const attach = useCallback(
    (client: OnlineClient) => {
      stop();
      clientRef.current = client;
      unsubscribeRef.current = client.subscribe((event) => {
        if (event.type === "joined") {
          joinedRef.current = true;
          codeRef.current = event.code;
          saveSeat(event.code, event.seat, event.token);
          saveCurrent(event.code);
          const stored = loadFlags(event.code, event.seat);
          dispatch({
            t: "joined",
            code: event.code,
            seat: event.seat,
            settings: settingsFromWire(event.settings),
            stored: stored && { flags: new Set(stored.squares), logLength: stored.logLength },
          });
          return;
        }
        if (event.type === "fatal" && event.reason === "game-gone" && codeRef.current !== null) {
          clearGame(codeRef.current);
        }
        dispatch({ t: "client", event });
        // A create or join that never got a seat is over; the lobby shows why.
        if (!joinedRef.current && (event.type === "error" || event.type === "fatal")) {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          clientRef.current?.close();
          clientRef.current = null;
        }
      });
    },
    [stop],
  );

  const begin = useCallback(
    (start: (client: OnlineClient) => void, code: string | null): boolean => {
      const client = createClient();
      if (client === null) {
        dispatch({ t: "reset", lobbyError: "Online play isn't set up for this build." });
        return false;
      }
      codeRef.current = code;
      joinedRef.current = false;
      dispatch({ t: "start", code });
      attach(client);
      start(client);
      return true;
    },
    [attach, createClient],
  );

  const create = useCallback(
    (settings?: GameSettings) => {
      begin((client) => {
        client.create(settings);
      }, null);
    },
    [begin],
  );

  const join = useCallback(
    (code: string) => {
      begin((client) => {
        client.join(code);
      }, code);
    },
    [begin],
  );

  // Resume the stored game, if any.
  useEffect(() => {
    if (resumeOnMount) {
      const code = loadCurrent();
      const seat = code === null ? null : loadSeat(code);
      if (code !== null && seat !== null) {
        begin((client) => {
          client.join(code, seat.token);
        }, code);
      }
    }
    return stop;
    // Runs once per mount; begin and stop are stable for the lifetime of the hook.
  }, []);

  // Persist private flags per game and seat (3.3).
  useEffect(() => {
    if (state.code !== null && state.seat !== null && state.flagsLogLength !== null) {
      saveFlags(state.code, state.seat, state.flags, state.flagsLogLength);
    }
  }, [state.code, state.seat, state.flags, state.flagsLogLength]);

  const leave = useCallback(() => {
    // After a takeover the other tab owns the stored seat, so it must not be wiped.
    if (codeRef.current !== null && state.fatal !== "taken-over") clearGame(codeRef.current);
    stop();
    codeRef.current = null;
    dispatch({ t: "reset", lobbyError: null });
  }, [stop, state.fatal]);

  const play = useCallback((move: Move) => {
    const client = clientRef.current;
    if (client === null) return;
    if (client.move(move.from, move.to, move.promotion ?? undefined)) dispatch({ t: "pending" });
  }, []);

  const toggle = useCallback((square: Square) => {
    dispatch({ t: "flag", square });
  }, []);

  const resign = useCallback(() => {
    clientRef.current?.resign();
  }, []);

  const offerDraw = useCallback(() => {
    if (clientRef.current?.offerDraw() === true) {
      dispatch({ t: "draw", draw: "mine", mustMove: true });
    }
  }, []);

  const acceptDraw = useCallback(() => {
    clientRef.current?.replyDraw(true);
  }, []);

  const declineDraw = useCallback(() => {
    if (clientRef.current?.replyDraw(false) === true) dispatch({ t: "draw", draw: "none" });
  }, []);

  const claimWin = useCallback(() => {
    clientRef.current?.claimWin();
  }, []);

  const togglePlacement = useCallback((square: Square) => {
    const client = clientRef.current;
    const current = stateRef.current;
    const placement = current.view?.placement;
    if (client === null || current.view?.phase.kind !== "placement" || !placement) return;
    if (placement.ready[current.seat ?? "w"] || current.doneSent) return;
    const own = current.ownOverride ?? placement.own ?? [];
    if (own.includes(square)) {
      if (client.unplace(square)) {
        dispatch({ t: "own", own: own.filter((sq) => sq !== square) });
      }
    } else if (own.length < placement.quota) {
      if (client.place(square)) dispatch({ t: "own", own: [...own, square] });
    }
  }, []);

  const donePlacement = useCallback(() => {
    if (clientRef.current?.placementDone() === true) dispatch({ t: "done" });
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ t: "dismissError" });
  }, []);

  const clearLobbyError = useCallback(() => {
    dispatch({ t: "clearLobbyError" });
  }, []);

  const over = state.gameOver !== null || state.view?.status.kind === "over";
  const phase: OnlinePhase = !state.active
    ? "lobby"
    : state.seat === null || state.view === null
      ? "connecting"
      : over
        ? "over"
        : state.seat === "w" && state.opponent === "unknown"
          ? "waiting"
          : "playing";
  const playing = phase === "playing";
  const placing = state.view?.phase.kind === "placement" && phase === "playing";

  // My own placement edits show at once, before the server confirms them (3.10).
  const view = useMemo((): PlacementView | null => {
    const base = state.view;
    if (!base?.placement) return base;
    const seat = state.seat;
    const ready =
      state.doneSent && seat !== null
        ? { ...base.placement.ready, [seat]: true }
        : base.placement.ready;
    return {
      ...base,
      placement: { ...base.placement, ready, own: state.ownOverride ?? base.placement.own },
    };
  }, [state.view, state.seat, state.doneSent, state.ownOverride]);

  // The countdown re-renders four times a second while a round is on.
  useEffect(() => {
    if (!placing || state.placementEndsAt === null) return;
    const timer = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [placing, state.placementEndsAt]);
  const placementMsLeft =
    placing && state.placementEndsAt !== null
      ? Math.max(0, state.placementEndsAt - Date.now())
      : null;

  return {
    active: state.active,
    phase,
    seat: state.seat,
    code: state.code,
    settings: state.settings,
    view,
    gameOver: state.gameOver,
    flags: state.flags,
    lastEvents: state.lastEvents,
    turnId: state.turnId,
    connection: state.connection,
    opponent: state.opponent,
    draw: state.draw,
    canOfferDraw: playing && state.draw === "none" && !state.mustMove,
    canMove:
      playing &&
      state.view !== null &&
      state.view.phase.kind === "play" &&
      state.view.turn === state.seat &&
      !state.pending,
    placementMsLeft,
    autoPlaced: state.autoPlaced,
    error: state.error,
    fatal: state.fatal,
    lobbyError: state.lobbyError,
    create,
    join,
    leave,
    play,
    toggleFlag: toggle,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    claimWin,
    togglePlacement,
    donePlacement,
    dismissError,
    clearLobbyError,
  };
}
