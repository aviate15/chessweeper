import { KING_STEPS } from "../chess/attacks";
import { offsetSquare } from "../chess/square";
import type { Color, Piece, Square } from "../chess/types";
import type { GameEvent } from "./events";
import { adjacentMineCount } from "./numbers";

/** Mutable scratch copy of the state a single move is being resolved against. */
export interface Working {
  board: (Piece | null)[];
  mines: Set<Square>;
  craters: Set<Square>;
  revealed: Set<Square>;
  lives: Record<Color, number>;
  events: GameEvent[];
}

export type LandingOutcome = "survived" | "destroyed";

/**
 * Resolves one piece landing on one square (design doc 3.8 step 4):
 * - no live mine: the piece survives and the square's number is revealed (3.2), craters
 *   included; a 0 reveals only itself (no flood fill);
 * - live mine under a non-king: the mine is consumed, a crater is left and the piece is
 *   destroyed (3.4);
 * - live mine under a king: the mine is consumed, a crater is left, the king loses a life
 *   and stays, so it survives the landing and reveals the square (3.6).
 * Captures never meet a mine (3.5).
 */
export function resolveLanding(
  work: Working,
  square: Square,
  piece: Piece,
  isCapture: boolean,
): LandingOutcome {
  if (!work.mines.has(square)) {
    revealSquare(work, square);
    return "survived";
  }
  if (isCapture) throw new Error("Invariant violated: a mine under a piece");

  work.mines.delete(square);
  work.craters.add(square);
  work.events.push({ type: "MineTriggered", square, by: piece });

  let outcome: LandingOutcome;
  if (piece.type === "k") {
    const livesLeft = work.lives[piece.color] - 1;
    work.lives[piece.color] = livesLeft;
    work.events.push({ type: "LifeLost", color: piece.color, square, livesLeft });
    revealSquare(work, square);
    outcome = "survived";
  } else {
    work.board[square] = null;
    work.events.push({ type: "PieceDestroyed", square, piece });
    outcome = "destroyed";
  }

  // Revealed numbers are live: revealed neighbours of the consumed mine drop by one (3.2).
  const updates: { square: Square; number: number }[] = [];
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && work.revealed.has(neighbour)) {
      updates.push({ square: neighbour, number: adjacentMineCount(work.mines, neighbour) });
    }
  }
  if (updates.length > 0) work.events.push({ type: "NumbersChanged", updates });
  return outcome;
}

function revealSquare(work: Working, square: Square): void {
  if (work.revealed.has(square)) return;
  work.revealed.add(square);
  work.events.push({
    type: "NumberRevealed",
    square,
    number: adjacentMineCount(work.mines, square),
  });
}
