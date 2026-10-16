import { isInCheck } from "./attacks";
import { legalMoves } from "./movegen";
import type { Position } from "./types";

export type ChessStatus = "ongoing" | "checkmate" | "stalemate";

/**
 * Plain-chess status for the side to move (design doc 3.6):
 * - checkmate: in check with no legal move. Judged by standard chess rules; hidden mines
 *   are ignored, so a mined escape square still counts as an escape.
 * - stalemate: not in check and no legal move. A draw.
 * Chessweeper has no other automatic draws (no repetition, 50-move or
 * insufficient-material rule), so everything else is "ongoing". King lives and mine
 * explosions are layered on top in a later milestone.
 */
export function gameStatus(position: Position): ChessStatus {
  if (legalMoves(position).length > 0) return "ongoing";
  return isInCheck(position) ? "checkmate" : "stalemate";
}
