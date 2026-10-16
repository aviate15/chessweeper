import type { Board } from "../chess/types";
import { mineCountFor, type GameConfig } from "./config";
import type { Working } from "./landing";
import { pickDistinct, type Rng } from "./rng";

/**
 * Full mine reset (design doc 3.7): the new count is `mineDensity` × the unoccupied
 * squares, rounded half-up and capped; mines go uniformly on any unoccupied square (any
 * rank, no exclusions). All revealed numbers and craters are cleared. Flags are not engine
 * state: the `Reshuffled` event tells clients to clear theirs.
 */
export function reshuffle(work: Working, board: Board, config: GameConfig, rng: Rng): void {
  const free: number[] = [];
  board.forEach((piece, square) => {
    if (piece === null) free.push(square);
  });
  const mineCount = mineCountFor(free.length, config);

  work.mines.clear();
  for (const square of pickDistinct(rng, free, mineCount)) work.mines.add(square);
  work.craters.clear();
  work.revealed.clear();
  work.events.push({ type: "Reshuffled", mineCount });
}
