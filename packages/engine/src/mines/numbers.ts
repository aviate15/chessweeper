import { KING_STEPS } from "../chess/attacks";
import { offsetSquare } from "../chess/square";
import type { Square } from "../chess/types";
import type { GameState } from "./state";

/** Live mines among the 8 squares around `square` (design doc 3.2). */
export function adjacentMineCount(mines: ReadonlySet<Square>, square: Square): number {
  let count = 0;
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && mines.has(neighbour)) count += 1;
  }
  return count;
}

/**
 * The number shown on each revealed square. Computed from the live mines every time,
 * never stored, so it stays live when a neighbouring mine is consumed (3.2).
 */
export function revealedNumbers(state: GameState): Map<Square, number> {
  const numbers = new Map<Square, number>();
  for (const square of state.public.revealed) {
    numbers.set(square, adjacentMineCount(state.hidden.mines, square));
  }
  return numbers;
}

/** How many live mines are on the board. Public information (design doc 3.2). */
export function liveMineCount(state: GameState): number {
  return state.hidden.mines.size;
}
