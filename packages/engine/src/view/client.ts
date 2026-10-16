import type { Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import type { Position, Square } from "../chess/types";
import type { Phase } from "../mines/state";
import type { PublicView } from "./types";

/*
 * Client-side helpers that work on a PublicView alone. Chess legality ignores hidden mines
 * (design doc 3.8 step 1), so the board, turn, castling rights and en passant square are
 * all a client needs.
 */

/** The phase of a view: Auto views omit it and are always in play (3.10). */
export const phaseOf = (view: PublicView): Phase => view.phase ?? { kind: "play" };

/** The chess position described by a view. */
export function positionFromView(view: PublicView): Position {
  return {
    board: view.board.map((piece) =>
      piece === null ? null : { color: piece.color, type: piece.type },
    ),
    turn: view.turn,
    castling: {
      wK: view.castling.wK,
      wQ: view.castling.wQ,
      bK: view.castling.bK,
      bQ: view.castling.bQ,
    },
    enPassant: view.enPassant,
    // No rule uses the half-move clock (3.6: no 50-move rule), so views do not carry it.
    halfmoveClock: 0,
    fullmoveNumber: view.fullmoveNumber,
  };
}

/**
 * Chess-legal moves for the side to move. During a check-exception chain (3.4) the position
 * is already in check, so these are exactly the moves that resolve it. Empty once the game is over.
 */
export function legalMovesFromView(view: PublicView): Move[] {
  if (view.status.kind === "over") return [];
  return legalMoves(positionFromView(view));
}

/** Legal destinations for the piece on `from`, for the legal-move dots (UI decision 7). */
export function destinationsFrom(view: PublicView, from: Square): Square[] {
  return [
    ...new Set(
      legalMovesFromView(view)
        .filter((m) => m.from === from)
        .map((m) => m.to),
    ),
  ];
}

/** The live number on a revealed square, or null if it is hidden. */
export function numberAt(view: PublicView, square: Square): number | null {
  return view.revealed.find((r) => r.square === square)?.number ?? null;
}

export function isCrater(view: PublicView, square: Square): boolean {
  return view.craters.includes(square);
}
