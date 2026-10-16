// Shared helpers for engine tests. Not exported from the package index.
import { moveToUci } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { parseSquare } from "../chess/square";
import { resolveMove } from "./resolve";
import { createSeededRng, type Rng } from "./rng";
import type { GameState } from "./state";

export function sq(name: string): number {
  const square = parseSquare(name);
  if (square === null) throw new Error(`bad square ${name}`);
  return square;
}

/** Plays a UCI move (a legal move for the side to move) through resolveMove. */
export function play(game: GameState, uci: string, rng: Rng = createSeededRng(1)) {
  const move = legalMoves(game.position).find((m) => moveToUci(m) === uci);
  if (move === undefined) throw new Error(`${uci} is not legal here`);
  return resolveMove(game, move, rng);
}

export const eventTypes = (events: readonly { type: string }[]) => events.map((e) => e.type);

/** The most mines in any 3x3 area of the board (design doc 3.1, 3.7). */
export function maxMinesIn3x3(mines: ReadonlySet<number>): number {
  let best = 0;
  for (let centre = 0; centre < 64; centre++) {
    let count = 0;
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        const file = (centre % 8) + df;
        const rank = Math.floor(centre / 8) + dr;
        if (file >= 0 && file < 8 && rank >= 0 && rank < 8 && mines.has(rank * 8 + file)) count++;
      }
    }
    best = Math.max(best, count);
  }
  return best;
}
