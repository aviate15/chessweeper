import { applyMove } from "./apply";
import { moveToUci } from "./move";
import { legalMoves } from "./movegen";
import type { Position } from "./types";

/**
 * Counts leaf nodes of the legal-move tree to the given depth. The standard way to
 * verify a move generator against published reference numbers.
 */
export function perft(position: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(position);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(applyMove(position, move), depth - 1);
  return nodes;
}

/**
 * perft split by first move (UCI → count). For debugging a mismatch: compare against
 * another engine's "divide" output to find which subtree is wrong.
 */
export function perftDivide(position: Position, depth: number): Map<string, number> {
  const result = new Map<string, number>();
  for (const move of legalMoves(position)) {
    result.set(moveToUci(move), perft(applyMove(position, move), depth - 1));
  }
  return result;
}
