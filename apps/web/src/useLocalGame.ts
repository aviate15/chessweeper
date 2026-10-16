import {
  createGame,
  flagsAfterEvents,
  noFlags,
  opponent,
  projectEvents,
  toGameOverView,
  toggleFlag,
  toPublicView,
  tryEndGame,
  tryResolveMove,
  type Color,
  type EventView,
  type Flags,
  type GameOverView,
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

interface Snapshot {
  readonly view: PublicView;
  readonly gameOver: GameOverView | null;
  /** Private flags, one set per colour (3.3). */
  readonly flags: { readonly w: Flags; readonly b: Flags };
  readonly offers: OfferState;
  /** Set while the board is hidden for a pass-and-play handoff. */
  readonly handoffTo: Color | null;
  /** Projected events of the latest move or ending (empty at game start). */
  readonly lastEvents: readonly EventView[];
  /** Increments per applied move, ending or new game. */
  readonly turnId: number;
}

export interface LocalGame {
  /** Everything the UI renders from: the public view, never the raw engine state. */
  readonly view: PublicView;
  readonly gameOver: GameOverView | null;
  /** The flags of the side to move (the only ones ever shown). */
  readonly flags: Flags;
  readonly offers: OfferState;
  readonly handoffTo: Color | null;
  readonly lastEvents: readonly EventView[];
  readonly turnId: number;
  play: (move: Move) => SafeError | null;
  toggleFlag: (square: Square) => void;
  dismissHandoff: () => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  newGame: () => void;
}

export interface UseLocalGameOptions {
  /** Injectable for tests; production uses the cryptographic RNG. */
  readonly rng?: Rng;
}

function snapshotOf(
  state: GameState,
  previous: Snapshot | null,
  prevTurnId = previous?.turnId ?? -1,
): Snapshot {
  const view = toPublicView(state, null);
  return {
    view,
    gameOver: toGameOverView(state, null),
    flags: previous?.flags ?? { w: noFlags(), b: noFlags() },
    offers: previous?.offers ?? initialOffers,
    handoffTo: null,
    lastEvents: [],
    turnId: prevTurnId + 1,
  };
}

/** Local pass-and-play game. The engine state lives in a ref and is only touched here. */
export function useLocalGame(options: UseLocalGameOptions = {}): LocalGame {
  const [init] = useState(() => {
    const rng = options.rng ?? createCryptoRng();
    return { rng, state: createGame({ rng }) };
  });
  const rng = init.rng;
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
        return {
          ...next,
          flags: {
            w: flagsAfterEvents(prev.flags.w, events),
            b: flagsAfterEvents(prev.flags.b, events),
          },
          offers: offersAfterMove(prev.offers, mover),
          handoffTo: handoffAfterMove(mover, next.view),
          lastEvents: events,
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

  return {
    view: snap.view,
    gameOver: snap.gameOver,
    flags: snap.flags[snap.view.turn],
    offers: snap.offers,
    handoffTo: snap.handoffTo,
    lastEvents: snap.lastEvents,
    turnId: snap.turnId,
    play,
    toggleFlag: (square) => {
      setSnap((prev) => {
        const side = prev.view.turn;
        return { ...prev, flags: { ...prev.flags, [side]: toggleFlag(prev.flags[side], square) } };
      });
    },
    dismissHandoff: () => {
      setSnap((prev) => ({ ...prev, handoffTo: null }));
    },
    resign: () => {
      finish("resignation", snap.view.turn);
    },
    offerDraw: () => {
      setSnap((prev) => ({ ...prev, offers: offerDraw(prev.offers, prev.view.turn) }));
    },
    acceptDraw: () => {
      if (snap.offers.pending !== null) finish("agreement", opponent(snap.offers.pending));
    },
    declineDraw: () => {
      setSnap((prev) => ({ ...prev, offers: declineDraw(prev.offers) }));
    },
    newGame: () => {
      stateRef.current = createGame({ rng });
      setSnap((prev) => snapshotOf(stateRef.current, null, prev.turnId));
    },
  };
}
