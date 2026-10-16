import { KING_STEPS } from "../chess/attacks";
import { offsetSquare, rankOf } from "../chess/square";
import type { Square } from "../chess/types";
import type { Working } from "./landing";
import type { Rng } from "./rng";

/** Ranks 3-6 (0-based 2..5), where mines start (design doc 3.1). */
const isMineZone = (square: Square): boolean => rankOf(square) >= 2 && rankOf(square) <= 5;

/** Key of the revealed squares next to `square`; equal keys mean identical revealed numbers. */
function revealedNeighbours(work: Working, square: Square): string {
  const found: Square[] = [];
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && work.revealed.has(neighbour)) found.push(neighbour);
  }
  return found.sort((a, b) => a - b).join(",");
}

/**
 * Safe start (design doc 3.1): moves the mine under a side's first landing square so the
 * landing is safe. The new square is free (no piece, no mine, not a revealed square or a
 * crater, not the landing square) and touches exactly the same revealed squares as the old
 * one, so no revealed number changes. Order of preference: ranks 3-6, then any rank; if
 * neither has such a square the mine is removed. Emits the server-only `MineRelocated`.
 */
export function relocateSafeStartMine(work: Working, square: Square, rng: Rng): void {
  const wanted = revealedNeighbours(work, square);
  const free: Square[] = [];
  work.board.forEach((piece, candidate) => {
    if (
      piece === null &&
      candidate !== square &&
      !work.mines.has(candidate) &&
      !work.revealed.has(candidate) &&
      !work.craters.has(candidate) &&
      revealedNeighbours(work, candidate) === wanted
    ) {
      free.push(candidate);
    }
  });
  const inZone = free.filter(isMineZone);
  const pool = inZone.length > 0 ? inZone : free;
  const to = pool.length > 0 ? (pool[rng.nextInt(pool.length)] ?? null) : null;

  work.mines.delete(square);
  if (to !== null) work.mines.add(to);
  work.events.push({ type: "MineRelocated", from: square, to });
}
