import { parseSquare, rankOf, squareName, squareOf } from "./square";
import type { CastlingRights, Color, Piece, PieceType, Position } from "./types";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class FenError extends Error {
  constructor(fen: string, reason: string) {
    super(`Invalid FEN "${fen}": ${reason}`);
    this.name = "FenError";
  }
}

const PIECE_TYPES: readonly PieceType[] = ["p", "n", "b", "r", "q", "k"];

function pieceFromChar(char: string): Piece | null {
  const lower = char.toLowerCase();
  const type = PIECE_TYPES.find((t) => t === lower);
  if (type === undefined) return null;
  return { color: char === lower ? "b" : "w", type };
}

function pieceToChar(piece: Piece): string {
  return piece.color === "w" ? piece.type.toUpperCase() : piece.type;
}

function parseCount(fen: string, text: string, field: string, min: number): number {
  if (!/^\d+$/.test(text)) throw new FenError(fen, `${field} must be a whole number`);
  const value = Number(text);
  if (value < min) throw new FenError(fen, `${field} must be at least ${String(min)}`);
  return value;
}

/**
 * Parses a FEN string. The halfmove and fullmove fields are optional and default to
 * "0 1" (some reference FENs, such as Kiwipete, omit them).
 */
export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4 || fields.length > 6) {
    throw new FenError(fen, "expected 4 to 6 space-separated fields");
  }
  const [placement = "", side = "", castlingText = "", epText = "", half = "0", full = "1"] =
    fields;

  // Placement lists rank 8 first, each rank from file a to h.
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new FenError(fen, "piece placement must have 8 ranks");
  const board: (Piece | null)[] = new Array<Piece | null>(64).fill(null);
  ranks.forEach((rankText, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const char of rankText) {
      if (/[1-8]/.test(char)) {
        file += Number(char);
        continue;
      }
      const piece = pieceFromChar(char);
      if (piece === null) throw new FenError(fen, `unknown piece letter "${char}"`);
      if (file > 7) throw new FenError(fen, `rank ${String(rank + 1)} has more than 8 squares`);
      if (piece.type === "p" && (rank === 0 || rank === 7)) {
        throw new FenError(fen, "pawns cannot stand on the first or last rank");
      }
      board[squareOf(file, rank)] = piece;
      file += 1;
    }
    if (file !== 8) throw new FenError(fen, `rank ${String(rank + 1)} does not have 8 squares`);
  });

  for (const color of ["w", "b"] as const) {
    const kings = board.filter((p) => p?.type === "k" && p.color === color).length;
    if (kings !== 1)
      throw new FenError(fen, `${color === "w" ? "White" : "Black"} needs exactly one king`);
  }

  if (side !== "w" && side !== "b") throw new FenError(fen, 'side to move must be "w" or "b"');
  const turn: Color = side;

  if (!/^(-|K?Q?k?q?)$/.test(castlingText) || castlingText === "") {
    throw new FenError(fen, 'castling must be "-" or a subset of "KQkq" in that order');
  }
  const castling: CastlingRights = {
    wK: castlingText.includes("K"),
    wQ: castlingText.includes("Q"),
    bK: castlingText.includes("k"),
    bQ: castlingText.includes("q"),
  };

  let enPassant = null;
  if (epText !== "-") {
    enPassant = parseSquare(epText);
    // The target sits behind a pawn of the side that just moved: rank 6 if White is to move.
    const expectedRank = turn === "w" ? 5 : 2;
    if (enPassant === null || rankOf(enPassant) !== expectedRank) {
      throw new FenError(fen, `en passant square "${epText}" is not valid for this side to move`);
    }
  }

  return {
    board,
    turn,
    castling,
    enPassant,
    halfmoveClock: parseCount(fen, half, "halfmove clock", 0),
    fullmoveNumber: parseCount(fen, full, "fullmove number", 1),
  };
}

export function toFen(position: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = position.board[squareOf(file, rank)] ?? null;
      if (piece === null) {
        empty += 1;
        continue;
      }
      if (empty > 0) row += String(empty);
      empty = 0;
      row += pieceToChar(piece);
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }

  const { wK, wQ, bK, bQ } = position.castling;
  const castling = `${wK ? "K" : ""}${wQ ? "Q" : ""}${bK ? "k" : ""}${bQ ? "q" : ""}` || "-";
  const enPassant = position.enPassant === null ? "-" : squareName(position.enPassant);

  return [
    rows.join("/"),
    position.turn,
    castling,
    enPassant,
    String(position.halfmoveClock),
    String(position.fullmoveNumber),
  ].join(" ");
}
