/** Core chess types. Plain chess only: mines are layered on top in later milestones. */

export type Color = "w" | "b";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type PromotionPiece = "n" | "b" | "r" | "q";

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** 0..63, rank-major from White's side: a1 = 0, b1 = 1, ..., h1 = 7, a2 = 8, ..., h8 = 63. */
export type Square = number;

/** 64 entries indexed by Square; null is an empty square. */
export type Board = readonly (Piece | null)[];

export interface CastlingRights {
  readonly wK: boolean;
  readonly wQ: boolean;
  readonly bK: boolean;
  readonly bQ: boolean;
}

export interface Position {
  readonly board: Board;
  readonly turn: Color;
  readonly castling: CastlingRights;
  /** Square behind a pawn that just double-pushed (FEN convention: set on every double push). */
  readonly enPassant: Square | null;
  /**
   * Kept only so FEN round-trips faithfully. No rule uses it: Chessweeper has no
   * 50-move rule (design doc 3.6).
   */
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
}

export function opponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}
