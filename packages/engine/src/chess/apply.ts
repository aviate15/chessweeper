import { castleRookSquares, type Move } from "./move";
import { parseSquare } from "./square";
import type { Board, CastlingRights, Piece, Position, Square } from "./types";

function cornerSquare(name: string): Square {
  const square = parseSquare(name);
  if (square === null) throw new Error(`bad corner ${name}`);
  return square;
}

/** Castling right lost when anything moves from or to each rook's home corner. */
const CORNER_RIGHTS: readonly (readonly [Square, keyof CastlingRights])[] = [
  [cornerSquare("a1"), "wQ"],
  [cornerSquare("h1"), "wK"],
  [cornerSquare("a8"), "bQ"],
  [cornerSquare("h8"), "bK"],
];

/**
 * Returns a new board with the move's pieces relocated. Does not touch side to move,
 * castling rights or clocks, so the mine pipeline can reuse it (e.g. to remove a piece
 * destroyed on landing, design doc 3.4) without rewriting chess logic.
 */
export function movePiecesOnBoard(board: Board, move: Move): Board {
  const next = board.slice();
  const mover = next[move.from];
  if (mover == null) throw new Error("No piece on the move's origin square");

  if (move.captureSquare !== null) next[move.captureSquare] = null;
  next[move.from] = null;
  const landed: Piece =
    move.promotion === null ? mover : { color: mover.color, type: move.promotion };
  next[move.to] = landed;

  const rook = castleRookSquares(move);
  if (rook !== null) {
    next[rook.to] = next[rook.from] ?? null;
    next[rook.from] = null;
  }
  return next;
}

function updatedCastling(castling: CastlingRights, move: Move, mover: Piece): CastlingRights {
  let next = castling;
  if (mover.type === "k") {
    next =
      mover.color === "w" ? { ...next, wK: false, wQ: false } : { ...next, bK: false, bQ: false };
  }
  // A rook leaving its corner, or anything capturing on that corner, ends that right.
  for (const [corner, right] of CORNER_RIGHTS) {
    if ((move.from === corner || move.to === corner) && next[right]) {
      next = { ...next, [right]: false };
    }
  }
  return next;
}

/**
 * Plays a legal move and returns the next position. Immutable: the input position is
 * never modified. Callers are expected to pass a move from `legalMoves(position)`.
 */
export function applyMove(position: Position, move: Move): Position {
  const mover = position.board[move.from];
  if (mover == null) throw new Error("No piece on the move's origin square");

  const resetsClock = move.piece === "p" || move.captured !== null;
  return {
    board: movePiecesOnBoard(position.board, move),
    turn: position.turn === "w" ? "b" : "w",
    castling: updatedCastling(position.castling, move, mover),
    // The en passant target is the square the double-pushed pawn skipped over.
    enPassant: move.doublePush ? (move.from + move.to) / 2 : null,
    halfmoveClock: resetsClock ? 0 : position.halfmoveClock + 1,
    fullmoveNumber: position.turn === "b" ? position.fullmoveNumber + 1 : position.fullmoveNumber,
  };
}
