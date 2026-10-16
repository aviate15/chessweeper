import { KING_STEPS } from "../chess/attacks";
import { offsetSquare } from "../chess/square";
import type { Square } from "../chess/types";
import type { GameState, HiddenState } from "./state";

type Owned =
  { readonly w: ReadonlySet<Square>; readonly b: ReadonlySet<Square> } | null | undefined;

/** The big mines (Manual mode, 3.10): squares both players placed on. Empty in Auto mode. */
export function bigMineSquares(owned: Owned): Set<Square> {
  const big = new Set<Square>();
  if (owned == null) return big;
  for (const square of owned.w) if (owned.b.has(square)) big.add(square);
  return big;
}

/** What a mine on `square` counts as: 0 (none), 1 (single) or 2 (big mine, 3.10). */
export function mineWeight(
  hidden: Pick<HiddenState, "mines" | "owned">,
  square: Square,
): 0 | 1 | 2 {
  if (!hidden.mines.has(square)) return 0;
  return hidden.owned != null && hidden.owned.w.has(square) && hidden.owned.b.has(square) ? 2 : 1;
}

/**
 * Live mines among the 8 squares around `square` (design doc 3.2). `big` lists the big
 * mines among `mines`, each of which counts as 2 (3.10).
 */
export function adjacentMineCount(
  mines: ReadonlySet<Square>,
  square: Square,
  big?: ReadonlySet<Square>,
): number {
  let count = 0;
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && mines.has(neighbour)) {
      count += big?.has(neighbour) === true ? 2 : 1;
    }
  }
  return count;
}

/**
 * The number shown on each revealed square. Computed from the live mines every time,
 * never stored, so it stays live when a neighbouring mine is consumed (3.2).
 */
export function revealedNumbers(state: GameState): Map<Square, number> {
  const numbers = new Map<Square, number>();
  const big = bigMineSquares(state.hidden.owned);
  for (const square of state.public.revealed) {
    numbers.set(square, adjacentMineCount(state.hidden.mines, square, big));
  }
  return numbers;
}

/**
 * How many live mines are on the board. Public information (design doc 3.2); a big mine
 * counts as 2 (3.10).
 */
export function liveMineCount(state: GameState): number {
  return state.hidden.mines.size + bigMineSquares(state.hidden.owned).size;
}
