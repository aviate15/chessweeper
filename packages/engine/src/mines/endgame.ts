import type { Color } from "../chess/types";
import { opponent } from "../chess/types";
import type { PublicEvent } from "./events";
import { GameOverError, type Resolution } from "./resolve";
import type { GameResult, GameState } from "./state";

/**
 * A non-move ending (design doc 3.6). `by` is the side that resigned, accepted the draw, or
 * was absent past the grace period. The result is derived, so a draw by resignation cannot
 * be expressed.
 */
export interface Ending {
  readonly reason: "resignation" | "agreement" | "abandonment";
  readonly by: Color;
}

/**
 * Ends the game without a move (3.6): resignation and abandonment lose for `by`, agreement is
 * a draw. Adds the public `GameOver` event and a log entry for `by`. The no-capture counter
 * is untouched, nothing reshuffles, and a pending check-exception chain is cleared.
 * Immutable: returns a new state and the events.
 */
export function endGame(state: GameState, ending: Ending): Resolution {
  if (state.public.status.kind === "over") throw new GameOverError();
  const result: GameResult = ending.reason === "agreement" ? "draw" : opponent(ending.by);
  const event: PublicEvent = { type: "GameOver", result, reason: ending.reason };
  return {
    state: {
      ...state,
      public: {
        ...state.public,
        status: { kind: "over", result, reason: ending.reason },
        checkException: null,
        log: [...state.public.log, { color: ending.by, events: [event] }],
      },
      hidden: { ...state.hidden, chainCaptured: false },
    },
    events: [event],
  };
}
