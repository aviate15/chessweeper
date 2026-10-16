import { rankOf, squareName, squareOf } from "./square";
import type { PieceType, PromotionPiece, Square } from "./types";

/**
 * A fully described chess move. Every flag the later mine pipeline needs is explicit,
 * so it never has to re-derive what kind of move this was (design doc 3.5, 3.8).
 */
export interface Move {
  readonly from: Square;
  /** Where the moving piece lands. For castling, the king's destination. */
  readonly to: Square;
  readonly piece: PieceType;
  readonly captured: PieceType | null;
  /** Square of the captured piece. Differs from `to` only for en passant. */
  readonly captureSquare: Square | null;
  readonly promotion: PromotionPiece | null;
  readonly castle: "king" | "queen" | null;
  readonly enPassant: boolean;
  readonly doublePush: boolean;
}

/** UCI long algebraic notation, e.g. "e2e4", "e7e8q", "e1g1" for castling. */
export function moveToUci(move: Move): string {
  return `${squareName(move.from)}${squareName(move.to)}${move.promotion ?? ""}`;
}

export interface RookShift {
  readonly from: Square;
  readonly to: Square;
}

/**
 * For a castling move, where the rook starts and lands: kingside h-file → f-file,
 * queenside a-file → d-file, on the king's rank. Null for any other move.
 * The rook's landing square is a second landing square for mine checks (design doc 3.5).
 */
export function castleRookSquares(move: Move): RookShift | null {
  if (move.castle === null) return null;
  const rank = rankOf(move.from);
  return move.castle === "king"
    ? { from: squareOf(7, rank), to: squareOf(5, rank) }
    : { from: squareOf(0, rank), to: squareOf(3, rank) };
}
