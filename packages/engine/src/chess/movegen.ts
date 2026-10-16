import { movePiecesOnBoard } from "./apply";
import {
  BISHOP_RAYS,
  type Direction,
  findKing,
  isSquareAttacked,
  KING_STEPS,
  KNIGHT_JUMPS,
  ROOK_RAYS,
} from "./attacks";
import type { Move } from "./move";
import { offsetSquare, rankOf, squareOf } from "./square";
import type { Color, PieceType, Position, PromotionPiece, Square } from "./types";
import { opponent } from "./types";

const PROMOTIONS: readonly PromotionPiece[] = ["q", "r", "b", "n"];

/**
 * All legal moves for the side to move. Standard chess legality; hidden mines play no
 * part (design doc 3.8 step 1).
 *
 * Approach: generate pseudo-legal moves (moves that follow each piece's movement rules
 * but may leave the own king attacked), then keep only those that leave the king safe.
 * This make-and-test filter handles pins, moving into check, double check and the
 * en passant discovered-check case without special-case code.
 */
export function legalMoves(position: Position): Move[] {
  return pseudoLegalMoves(position).filter((move) => leavesKingSafe(position, move));
}

function leavesKingSafe(position: Position, move: Move): boolean {
  const board = movePiecesOnBoard(position.board, move);
  return !isSquareAttacked(board, findKing(board, position.turn), opponent(position.turn));
}

function pseudoLegalMoves(position: Position): Move[] {
  const moves: Move[] = [];
  position.board.forEach((piece, from) => {
    if (piece?.color !== position.turn) return;
    switch (piece.type) {
      case "p":
        addPawnMoves(position, from, moves);
        break;
      case "n":
        addStepMoves(position, from, "n", KNIGHT_JUMPS, moves);
        break;
      case "b":
        addSlidingMoves(position, from, "b", BISHOP_RAYS, moves);
        break;
      case "r":
        addSlidingMoves(position, from, "r", ROOK_RAYS, moves);
        break;
      case "q":
        addSlidingMoves(position, from, "q", [...ROOK_RAYS, ...BISHOP_RAYS], moves);
        break;
      case "k":
        addStepMoves(position, from, "k", KING_STEPS, moves);
        addCastlingMoves(position, from, moves);
        break;
    }
  });
  return moves;
}

function quietOrCapture(position: Position, from: Square, to: Square, piece: PieceType): Move {
  const target = position.board[to] ?? null;
  return {
    from,
    to,
    piece,
    captured: target?.type ?? null,
    captureSquare: target === null ? null : to,
    promotion: null,
    castle: null,
    enPassant: false,
    doublePush: false,
  };
}

/** Knight and king: one step in each direction, onto an empty or enemy square. */
function addStepMoves(
  position: Position,
  from: Square,
  piece: PieceType,
  steps: readonly Direction[],
  moves: Move[],
): void {
  for (const [df, dr] of steps) {
    const to = offsetSquare(from, df, dr);
    if (to === null || position.board[to]?.color === position.turn) continue;
    moves.push(quietOrCapture(position, from, to, piece));
  }
}

/** Bishop, rook, queen: slide along each ray until blocked; may capture the blocker. */
function addSlidingMoves(
  position: Position,
  from: Square,
  piece: PieceType,
  rays: readonly Direction[],
  moves: Move[],
): void {
  for (const [df, dr] of rays) {
    let to = offsetSquare(from, df, dr);
    while (to !== null) {
      const blocker = position.board[to] ?? null;
      if (blocker?.color === position.turn) break;
      moves.push(quietOrCapture(position, from, to, piece));
      if (blocker !== null) break;
      to = offsetSquare(to, df, dr);
    }
  }
}

function addPawnMoves(position: Position, from: Square, moves: Move[]): void {
  const color = position.turn;
  const forward = color === "w" ? 1 : -1;
  const startRank = color === "w" ? 1 : 6;
  const lastRank = color === "w" ? 7 : 0;

  // Reaching the last rank turns one pawn move into four, one per promotion piece.
  const push = (move: Move): void => {
    if (rankOf(move.to) !== lastRank) {
      moves.push(move);
      return;
    }
    for (const promotion of PROMOTIONS) moves.push({ ...move, promotion });
  };

  const oneStep = offsetSquare(from, 0, forward);
  if (oneStep !== null && position.board[oneStep] == null) {
    push(quietOrCapture(position, from, oneStep, "p"));
    const twoStep = offsetSquare(from, 0, 2 * forward);
    if (rankOf(from) === startRank && twoStep !== null && position.board[twoStep] == null) {
      moves.push({ ...quietOrCapture(position, from, twoStep, "p"), doublePush: true });
    }
  }

  for (const df of [-1, 1]) {
    const to = offsetSquare(from, df, forward);
    if (to === null) continue;
    const target = position.board[to] ?? null;
    if (target !== null && target.color !== color) {
      push(quietOrCapture(position, from, to, "p"));
    } else if (to === position.enPassant) {
      // En passant: land on the empty target square, capture the pawn beside us
      // that just double-pushed past it.
      const captureSquare = offsetSquare(to, 0, -forward);
      const victim = captureSquare === null ? null : (position.board[captureSquare] ?? null);
      if (captureSquare !== null && victim?.type === "p" && victim.color !== color) {
        moves.push({
          ...quietOrCapture(position, from, to, "p"),
          captured: "p",
          captureSquare,
          enPassant: true,
        });
      }
    }
  }
}

interface CastleRule {
  readonly side: "king" | "queen";
  readonly right: "wK" | "wQ" | "bK" | "bQ";
  readonly rookFile: number;
  readonly kingTo: number;
  /** Files that must be empty between king and rook. */
  readonly emptyFiles: readonly number[];
  /** Files the king stands on, crosses or lands on; none may be attacked. */
  readonly kingPathFiles: readonly number[];
}

// prettier-ignore
const CASTLE_RULES: Readonly<Record<Color, readonly CastleRule[]>> = {
  w: [
    { side: "king", right: "wK", rookFile: 7, kingTo: 6, emptyFiles: [5, 6], kingPathFiles: [4, 5, 6] },
    { side: "queen", right: "wQ", rookFile: 0, kingTo: 2, emptyFiles: [1, 2, 3], kingPathFiles: [4, 3, 2] },
  ],
  b: [
    { side: "king", right: "bK", rookFile: 7, kingTo: 6, emptyFiles: [5, 6], kingPathFiles: [4, 5, 6] },
    { side: "queen", right: "bQ", rookFile: 0, kingTo: 2, emptyFiles: [1, 2, 3], kingPathFiles: [4, 3, 2] },
  ],
};

/**
 * Castling (standard rules, design doc 3.5): the right must still be held, the king and
 * rook must be on their home squares, every square between them must be empty, and the
 * king may not castle out of check, through an attacked square or into check.
 * On the queenside the rook passes b1/b8 but the king does not, so that square may be
 * attacked.
 */
function addCastlingMoves(position: Position, from: Square, moves: Move[]): void {
  const color = position.turn;
  const homeRank = color === "w" ? 0 : 7;
  if (from !== squareOf(4, homeRank)) return;
  const enemy = opponent(color);

  for (const rule of CASTLE_RULES[color]) {
    if (!position.castling[rule.right]) continue;
    const rook = position.board[squareOf(rule.rookFile, homeRank)];
    if (rook?.type !== "r" || rook.color !== color) continue;
    if (rule.emptyFiles.some((f) => position.board[squareOf(f, homeRank)] != null)) continue;
    if (
      rule.kingPathFiles.some((f) => isSquareAttacked(position.board, squareOf(f, homeRank), enemy))
    ) {
      continue;
    }
    moves.push({
      ...quietOrCapture(position, from, squareOf(rule.kingTo, homeRank), "k"),
      castle: rule.side,
    });
  }
}
