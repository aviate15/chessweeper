import type { Move } from "../chess/move";
import { endGame, type Ending } from "../mines/endgame";
import {
  GameOverError,
  IllegalMoveError,
  PlacementInProgressError,
  resolveMove,
  type Resolution,
} from "../mines/resolve";
import type { Rng } from "../mines/rng";
import type { GameState } from "../mines/state";
import type { SafeError } from "./types";

/*
 * The error boundary. Engine errors can mention hidden state (for example the internal
 * "capture meets a mine" invariant), so nothing from an engine error is ever forwarded.
 * `toSafeError` is the single mapping and its messages are fixed strings. The server must
 * resolve moves through `tryResolveMove` and never send `error.message` of a caught value.
 */

const ILLEGAL: SafeError = { code: "illegal-move", message: "Illegal move" };
const OVER: SafeError = { code: "game-over", message: "The game is over" };
const NOT_PLAYING: SafeError = { code: "not-playing", message: "Mines are being placed" };
const INTERNAL: SafeError = { code: "internal", message: "Internal error" };

/** Maps any thrown value to a SafeError. Unknown errors become a generic internal error. */
export function toSafeError(error: unknown): SafeError {
  const known =
    error instanceof IllegalMoveError
      ? ILLEGAL
      : error instanceof GameOverError
        ? OVER
        : error instanceof PlacementInProgressError
          ? NOT_PLAYING
          : INTERNAL;
  return { code: known.code, message: known.message };
}

export type TryResolve =
  | { readonly ok: true; readonly resolution: Resolution }
  | { readonly ok: false; readonly error: SafeError };

/** `resolveMove` that never throws: failures come back as a SafeError (3.6: moves after game over are rejected). */
export function tryResolveMove(state: GameState, move: Move, rng: Rng): TryResolve {
  try {
    return { ok: true, resolution: resolveMove(state, move, rng) };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
}

/** `endGame` that never throws: failures come back as a SafeError (3.6: nothing happens after game over). */
export function tryEndGame(state: GameState, ending: Ending): TryResolve {
  try {
    return { ok: true, resolution: endGame(state, ending) };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
}
