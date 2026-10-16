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
