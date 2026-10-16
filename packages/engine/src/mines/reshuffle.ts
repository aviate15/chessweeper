import type { Board } from "../chess/types";
import { mineCountFor, type GameConfig } from "./config";
import type { Working } from "./landing";
import type { Rng } from "./rng";
import { placeSpread } from "./spread";

/**
 * Full mine reset (design doc 3.7): the new count is `mineDensity` × the unoccupied
 * squares, rounded half-up and capped; mines go at random on unoccupied squares (any rank)
 * with at most 2 mines in any 3x3 area, so fewer mines are placed if the limit leaves no
 * room, and `Reshuffled.mineCount` is the number actually placed. All revealed numbers and craters are cleared. Flags are not engine
 * state: the `Reshuffled` event tells clients to clear theirs.
 */
export function reshuffle(work: Working, board: Board, config: GameConfig, rng: Rng): void {
  const free: number[] = [];
  board.forEach((piece, square) => {
    if (piece === null) free.push(square);
  });
  const placed = placeSpread(rng, free, mineCountFor(free.length, config));
  const mineCount = placed.length;

  work.mines.clear();
  for (const square of placed) work.mines.add(square);
  work.craters.clear();
  work.revealed.clear();
  work.events.push({ type: "Reshuffled", mineCount });
}
