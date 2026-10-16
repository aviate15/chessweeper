import type { GameState } from "./state";

/**
 * Turns left before the next reshuffle (design doc 3.7). Derived, never stored. Public: the
 * mine count and the reshuffle countdown are visible to both players (3.2).
 */
export function turnsUntilReshuffle(state: GameState): number {
  return state.config.reshuffleInterval - state.public.noCaptureCount;
}

/**
 * The no-capture counter after a completed turn (3.7): any turn that captures a piece
 * resets it to 0, every other turn (explosions included) adds one.
 */
export function nextNoCaptureCount(count: number, captured: boolean): number {
  return captured ? 0 : count + 1;
}
