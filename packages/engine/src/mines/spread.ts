import { fileOf, rankOf, squareOf } from "../chess/square";
import type { Square } from "../chess/types";
import { pickDistinct, type Rng } from "./rng";

/** At most this many mines in any 3x3 area (design doc 3.1, 3.7). */
export const MAX_MINES_PER_3X3 = 2;

/** Random greedy packing can fall short of the count, so it is retried a few times. */
const ATTEMPTS = 50;

/** The squares of the 3x3 area centred on `centre`, clipped at the board edge. */
function area(centre: Square): Square[] {
  const squares: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const file = fileOf(centre) + df;
      const rank = rankOf(centre) + dr;
      if (file >= 0 && file < 8 && rank >= 0 && rank < 8) squares.push(squareOf(file, rank));
    }
  }
  return squares;
}

const AREAS: readonly (readonly Square[])[] = Array.from({ length: 64 }, (_, s) => area(s));

/**
 * Places up to `count` mines on distinct `candidates`, uniformly at random among the
 * layouts the greedy search finds, with at most `MAX_MINES_PER_3X3` mines in any 3x3
 * area (design doc 3.1, 3.7). Returns fewer than `count` when the limit leaves no room.
 */
export function placeSpread(rng: Rng, candidates: readonly Square[], count: number): Square[] {
  let best: Square[] = [];
  for (let attempt = 0; attempt < ATTEMPTS && best.length < count; attempt++) {
    const inArea = new Array<number>(64).fill(0);
    const placed: Square[] = [];
    for (const square of pickDistinct(rng, candidates, candidates.length)) {
      if (placed.length >= count) break;
      const neighbours = AREAS[square] ?? [];
      if (neighbours.some((centre) => (inArea[centre] ?? 0) >= MAX_MINES_PER_3X3)) continue;
      placed.push(square);
      for (const centre of neighbours) inArea[centre] = (inArea[centre] ?? 0) + 1;
    }
    if (placed.length > best.length) best = placed;
  }
  return best;
}
