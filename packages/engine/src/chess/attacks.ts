import { offsetSquare } from "./square";
import type { Board, Color, Piece, PieceType, Position, Square } from "./types";

/** (file, rank) steps. */
export type Direction = readonly [number, number];

// prettier-ignore
export const KNIGHT_JUMPS: readonly Direction[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
// prettier-ignore
export const ROOK_RAYS: readonly Direction[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];
// prettier-ignore
export const BISHOP_RAYS: readonly Direction[] = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
export const KING_STEPS: readonly Direction[] = [...ROOK_RAYS, ...BISHOP_RAYS];

function isPiece(piece: Piece | null | undefined, color: Color, types: readonly PieceType[]) {
  return piece?.color === color && types.includes(piece.type);
}

/** The first piece along a ray from `from` (exclusive), or null if the ray leaves the board. */
function firstPieceOnRay(board: Board, from: Square, [df, dr]: Direction): Piece | null {
  let sq = offsetSquare(from, df, dr);
  while (sq !== null) {
    const piece = board[sq];
    if (piece != null) return piece;
    sq = offsetSquare(sq, df, dr);
  }
  return null;
}

/**
 * Is `target` attacked by any piece of color `by`? Scans outward from the target:
 * a square is attacked by a knight if a knight sits a knight's jump away, and so on.
 * Mines play no part (design doc 3.8 step 1: legality ignores mines).
 */
export function isSquareAttacked(board: Board, target: Square, by: Color): boolean {
  for (const [df, dr] of KNIGHT_JUMPS) {
    const sq = offsetSquare(target, df, dr);
    if (sq !== null && isPiece(board[sq], by, ["n"])) return true;
  }

  // A white pawn attacks diagonally upward, so it sits one rank BELOW the target it attacks.
  const pawnRank = by === "w" ? -1 : 1;
  for (const df of [-1, 1]) {
    const sq = offsetSquare(target, df, pawnRank);
    if (sq !== null && isPiece(board[sq], by, ["p"])) return true;
  }

  for (const [df, dr] of KING_STEPS) {
    const sq = offsetSquare(target, df, dr);
    if (sq !== null && isPiece(board[sq], by, ["k"])) return true;
  }

  for (const ray of ROOK_RAYS) {
    if (isPiece(firstPieceOnRay(board, target, ray), by, ["r", "q"])) return true;
  }
  for (const ray of BISHOP_RAYS) {
    if (isPiece(firstPieceOnRay(board, target, ray), by, ["b", "q"])) return true;
  }
  return false;
}

export function findKing(board: Board, color: Color): Square {
  const square = board.findIndex((p) => p?.type === "k" && p.color === color);
  if (square < 0) throw new Error(`No ${color} king on the board`);
  return square;
}

export function isInCheck(position: Position, color: Color = position.turn): boolean {
  const enemy = color === "w" ? "b" : "w";
  return isSquareAttacked(position.board, findKing(position.board, color), enemy);
}
