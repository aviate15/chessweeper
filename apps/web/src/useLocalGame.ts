import {
  createGame,
  finishPlacement,
  flagsAfterEvents,
  markReady,
  noFlags,
  opponent,
  phaseOf,
  placeMine,
  projectEvents,
  toGameOverView,
  toggleFlag,
  toPublicView,
  tryEndGame,
  tryResolveMove,
  unplaceMine,
  type Color,
  type EventView,
  type Flags,
  type GameConfig,
  type GameOverView,
  type GameEvent,
  type GameState,
  type Move,
  type PublicView,
  type Rng,
  type SafeError,
  type Square,
} from "@chessweeper/engine";
import { useCallback, useRef, useState } from "react";
import {
  declineDraw,
  initialOffers,
  offerDraw,
  offersAfterMove,
  type OfferState,
} from "./drawOffers";
import { handoffAfterMove } from "./handoff";
import { createCryptoRng } from "./rng";

/** Mines the engine placed at random for each side when a round ended, until that side moves. */
interface AutoPlaced {
  readonly w: number;
  readonly b: number;
}

interface Snapshot {
  readonly view: PublicView;
  readonly gameOver: GameOverView | null;
  /** Private flags, one set per colour (3.3). */
  readonly flags: { readonly w: Flags; readonly b: Flags };
  readonly offers: OfferState;
  /** Set while the board is hidden for a pass-and-play handoff. */
  readonly handoffTo: Color | null;
  /** The handoff is to a player who places mines next (3.10), not to move. */
  readonly handoffPlacing: boolean;
  /** Projected events of the latest move or ending (empty at game start). */
  readonly lastEvents: readonly EventView[];
  /** Increments per applied move, ending or new game. */
  readonly turnId: number;
  readonly autoPlaced: AutoPlaced | null;
}

export interface LocalGame {
  /** Everything the UI renders from: the public view, never the raw engine state. */
  readonly view: PublicView;
  readonly gameOver: GameOverView | null;
  /** The flags of the side to move (the only ones ever shown). */
  readonly flags: Flags;
  readonly offers: OfferState;
  readonly handoffTo: Color | null;
  readonly handoffPlacing: boolean;
  readonly lastEvents: readonly EventView[];
  readonly turnId: number;
  /** Whose mines are being placed right now (3.10), or null outside a placement round. */
  readonly placingColor: Color | null;
  /** The side at the device: the placer during placement, else the side to move. */
  readonly actor: Color;
  /** Mines placed at random for the side to move at the end of the last round, or null. */
  readonly autoPlaced: number | null;
  play: (move: Move) => SafeError | null;
  toggleFlag: (square: Square) => void;
  /** Place or take back one of the current placer's mines (3.10). */
  togglePlacement: (square: Square) => void;
  /** The current placer presses Done (3.10). */
  donePlacement: () => void;
  dismissHandoff: () => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  /** Starts a fresh game, optionally with a new config (the settings chosen in New game). */
  newGame: (config?: GameConfig) => void;
}

export interface UseLocalGameOptions {
  /** Injectable for tests; production uses the cryptographic RNG. */
  readonly rng?: Rng;
  /** Rules config for new games. Read at New game time; the running game is never changed. */
  readonly config?: GameConfig;
}

/** Whose mines the device is collecting: White first, then Black (3.10). */
function placerOf(state: GameState): Color | null {
  const phase = state.public.phase;
  if (phase.kind !== "placement") return null;
  return phase.ready.w ? "b" : "w";
}

/** The view for the device: during placement it carries the current placer's own draft. */
function viewOf(state: GameState): PublicView {
  return toPublicView(state, placerOf(state));
}

function gameOverOf(state: GameState): GameOverView | null {
  return toGameOverView(state, null);
}

function snapshotOf(
  state: GameState,
  previous: Snapshot | null,
  prevTurnId = previous?.turnId ?? -1,
): Snapshot {
  return {
    view: viewOf(state),
    gameOver: gameOverOf(state),
    flags: previous?.flags ?? { w: noFlags(), b: noFlags() },
    offers: previous?.offers ?? initialOffers,
    handoffTo: null,
    handoffPlacing: false,
    lastEvents: [],
    turnId: prevTurnId + 1,
    autoPlaced: previous?.autoPlaced ?? null,
  };
}

/** The random-fill counts (each placer's own `MinesAutoPlaced` event), or null when none. */
function autoPlacedOf(events: readonly GameEvent[]): AutoPlaced | null {
  const countFor = (viewer: Color): number => {
    for (const event of projectEvents(events, viewer)) {
      if (event.type === "MinesAutoPlaced" && event.color === viewer) return event.count;
    }
    return 0;
  };
  const w = countFor("w");
  const b = countFor("b");
  return w > 0 || b > 0 ? { w, b } : null;
}

/** Local pass-and-play game. The engine state lives in a ref and is only touched here. */
export function useLocalGame(options: UseLocalGameOptions = {}): LocalGame {
  const [init] = useState(() => {
    const rng = options.rng ?? createCryptoRng();
    return { rng, state: createGame(options.config ? { rng, config: options.config } : { rng }) };
  });
  const rng = init.rng;
  const configRef = useRef(options.config);
  configRef.current = options.config;
  const stateRef = useRef<GameState>(init.state);
  const [snap, setSnap] = useState<Snapshot>(() => snapshotOf(init.state, null));

  const play = useCallback(
    (move: Move): SafeError | null => {
      const state = stateRef.current;
      const mover = state.position.turn;
      const result = tryResolveMove(state, move, rng);
      if (!result.ok) return result.error;
      stateRef.current = result.resolution.state;
      const events = projectEvents(result.resolution.events);
      setSnap((prev) => {
        const next = snapshotOf(result.resolution.state, prev);
        // 3.10: a reshuffle in Manual mode starts a placement round, White first. Black, who
        // just moved, passes the device to White; White just keeps it.
        const placing = phaseOf(next.view).kind === "placement";
        const handoffTo = placing
          ? mover === "b"
            ? "w"
            : null
          : handoffAfterMove(mover, next.view);
        return {
          ...next,
          flags: {
            w: flagsAfterEvents(prev.flags.w, events),
            b: flagsAfterEvents(prev.flags.b, events),
          },
          offers: offersAfterMove(prev.offers, mover),
          handoffTo,
          handoffPlacing: placing && handoffTo !== null,
          lastEvents: events,
          // The mover has seen their notice by moving; the other side keeps theirs.
          autoPlaced: prev.autoPlaced && { ...prev.autoPlaced, [mover]: 0 },
        };
      });
      return null;
    },
    [rng],
  );

  const finish = useCallback((reason: "resignation" | "agreement", by: Color) => {
    const result = tryEndGame(stateRef.current, { reason, by });
    if (!result.ok) return;
    stateRef.current = result.resolution.state;
    const events = projectEvents(result.resolution.events);
    setSnap((prev) => ({
      ...snapshotOf(result.resolution.state, prev),
      handoffTo: null,
      lastEvents: events,
    }));
  }, []);

  const togglePlacement = useCallback((square: Square) => {
    const state = stateRef.current;
    const placer = placerOf(state);
    if (placer === null) return;
    const mine = state.hidden.drafts?.[placer].has(square) === true;
    const result = mine ? unplaceMine(state, placer, square) : placeMine(state, placer, square);
    if (!result.ok) return;
    stateRef.current = result.state;
    // Editing a draft is not a turn: keep the turn id so no effect or sound replays.
    setSnap((prev) => ({ ...prev, view: viewOf(result.state) }));
  }, []);

  const donePlacement = useCallback(() => {
    const state = stateRef.current;
    const placer = placerOf(state);
    if (placer === null) return;
    const ready = markReady(state, placer);
    if (!ready.ok) return;
    if (placer === "w") {
      // Hide the board, then Black places.
      stateRef.current = ready.state;
      setSnap((prev) => ({
        ...snapshotOf(ready.state, prev),
        handoffTo: "b",
        handoffPlacing: true,
      }));
      return;
    }
    // Both are ready: random-fill what is missing, merge the drafts and start play.
    const done = finishPlacement(ready.state, rng);
    stateRef.current = done.state;
    const events = projectEvents(done.events);
    setSnap((prev) => ({
      ...snapshotOf(done.state, prev),
      handoffTo: done.state.position.turn,
      handoffPlacing: false,
      lastEvents: events,
      autoPlaced: autoPlacedOf(done.events),
    }));
  }, [rng]);

  const placingColor = placingColorOfView(snap);
  const actor = actorOf(snap);
  const turn = snap.view.turn;

  return {
    view: snap.view,
    gameOver: snap.gameOver,
    flags: snap.flags[turn],
    offers: snap.offers,
    handoffTo: snap.handoffTo,
    handoffPlacing: snap.handoffPlacing,
    lastEvents: snap.lastEvents,
    turnId: snap.turnId,
    placingColor,
    actor,
    autoPlaced:
      phaseOf(snap.view).kind === "play" && snap.autoPlaced && snap.autoPlaced[turn] > 0
        ? snap.autoPlaced[turn]
        : null,
    play,
    toggleFlag: (square) => {
      setSnap((prev) => {
        const side = prev.view.turn;
        return { ...prev, flags: { ...prev.flags, [side]: toggleFlag(prev.flags[side], square) } };
      });
    },
    togglePlacement,
    donePlacement,
    dismissHandoff: () => {
      setSnap((prev) => ({ ...prev, handoffTo: null, handoffPlacing: false }));
    },
    resign: () => {
      finish("resignation", actor);
    },
    offerDraw: () => {
      setSnap((prev) => ({ ...prev, offers: offerDraw(prev.offers, actorOf(prev)) }));
    },
    acceptDraw: () => {
      if (snap.offers.pending !== null) finish("agreement", opponent(snap.offers.pending));
    },
    declineDraw: () => {
      setSnap((prev) => ({ ...prev, offers: declineDraw(prev.offers) }));
    },
    newGame: (next) => {
      if (next) configRef.current = next;
      const config = configRef.current;
      stateRef.current = createGame(config ? { rng, config } : { rng });
      setSnap((prev) => ({
        ...snapshotOf(stateRef.current, null, prev.turnId),
        autoPlaced: null,
      }));
    },
  };
}

/** The placer shown in a snapshot's view: White until White is ready, then Black. */
function placingColorOfView(snap: Snapshot): Color | null {
  const placement = snap.view.placement;
  if (!placement) return null;
  return placement.ready.w ? "b" : "w";
}

function actorOf(snap: Snapshot): Color {
  return placingColorOfView(snap) ?? snap.view.turn;
}
