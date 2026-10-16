import { KING_STEPS } from "../chess/attacks";
import { fileOf, offsetSquare, rankOf, squareOf } from "../chess/square";
import type { Color, Piece, Square } from "../chess/types";
import type { GameEvent } from "./events";
import { adjacentMineCount, bigMineSquares } from "./numbers";

/** Mutable scratch copy of the state a single move is being resolved against. */
export interface Working {
  board: (Piece | null)[];
  mines: Set<Square>;
  /** Manual mode (3.10): who placed the live mines (`mines` is their union); else null. */
  owned?: { w: Set<Square>; b: Set<Square> } | null;
  craters: Set<Square>;
  revealed: Set<Square>;
  lives: Record<Color, number>;
  events: GameEvent[];
  /**
   * Set when a big-mine blast destroyed a piece of the moving side (3.10), whether or not
   * it was the landing piece: it can leave the mover's own king in check (3.4).
   */
  moverLost?: boolean;
}

export type LandingOutcome = "survived" | "destroyed";

/** The 3x3 area around `centre`, clipped at the board edge, in ascending square order. */
export function blastArea(centre: Square): Square[] {
  const area: Square[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      const file = fileOf(centre) + df;
      const rank = rankOf(centre) + dr;
      if (file >= 0 && file < 8 && rank >= 0 && rank < 8) area.push(squareOf(file, rank));
    }
  }
  return area;
}

/** Removes a live mine (and its owners) from the working state. */
function consumeMine(work: Working, square: Square): void {
  work.mines.delete(square);
  if (work.owned != null) {
    work.owned.w.delete(square);
    work.owned.b.delete(square);
  }
}

/**
 * Resolves one piece landing on one square (design doc 3.8 step 4):
 * - no live mine: the piece survives and the square's number is revealed (3.2), craters
 *   included; a 0 reveals only itself (no flood fill);
 * - live mine under a non-king: the mine is consumed, a crater is left and the piece is
 *   destroyed (3.4);
 * - live mine under a king: the mine is consumed, a crater is left, the king loses a life
 *   and stays, so it survives the landing and reveals the square (3.6);
 * - big mine (Manual mode): blasts its 3x3 area (3.10).
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

  if (work.owned != null && work.owned.w.has(square) && work.owned.b.has(square)) {
    return blast(work, square, piece);
  }

  consumeMine(work, square);
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
  const big = bigMineSquares(work.owned);
  const updates: { square: Square; number: number }[] = [];
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && work.revealed.has(neighbour)) {
      updates.push({ square: neighbour, number: adjacentMineCount(work.mines, neighbour, big) });
    }
  }
  if (updates.length > 0) work.events.push({ type: "NumbersChanged", updates });
  return outcome;
}

/**
 * A big mine blast (design doc 3.10): every mine in the 3x3 area is consumed and every
 * area square becomes a crater. Every non-king piece in the area dies, both sides' and the
 * mover's included; every king in it loses exactly one life and stays. No chain reaction.
 * Only a king that landed on the big mine and survived reveals its square; the pieces
 * merely caught in the area reveal nothing.
 */
function blast(work: Working, square: Square, piece: Piece): LandingOutcome {
  const area = blastArea(square);
  const bigBefore = bigMineSquares(work.owned);
  const before = new Map<Square, number>();
  for (const revealed of work.revealed) {
    before.set(revealed, adjacentMineCount(work.mines, revealed, bigBefore));
  }

  work.events.push({ type: "BigMineBlasted", square, by: piece, area });
  for (const target of area) {
    consumeMine(work, target);
    work.craters.add(target);
  }

  let outcome: LandingOutcome = "survived";
  for (const target of area) {
    const victim = target === square ? piece : work.board[target]; // the original piece, so a pawn on a promotion square dies as a pawn (3.5)
    if (victim == null) continue;
    if (victim.type === "k") {
      const livesLeft = work.lives[victim.color] - 1;
      work.lives[victim.color] = livesLeft;
      work.events.push({ type: "LifeLost", color: victim.color, square: target, livesLeft });
    } else {
      work.board[target] = null;
      work.events.push({ type: "PieceDestroyed", square: target, piece: victim });
      if (victim.color === piece.color) work.moverLost = true;
      if (target === square) outcome = "destroyed";
    }
  }

  const bigAfter = bigMineSquares(work.owned);
  const updates: { square: Square; number: number }[] = [];
  for (const [revealed, was] of [...before].sort((a, b) => a[0] - b[0])) {
    const now = adjacentMineCount(work.mines, revealed, bigAfter);
    if (now !== was) updates.push({ square: revealed, number: now });
  }
  if (updates.length > 0) work.events.push({ type: "NumbersChanged", updates });

  if (piece.type === "k") revealSquare(work, square);
  return outcome;
}

function revealSquare(work: Working, square: Square): void {
  if (work.revealed.has(square)) return;
  work.revealed.add(square);
  work.events.push({
    type: "NumberRevealed",
    square,
    number: adjacentMineCount(work.mines, square, bigMineSquares(work.owned)),
  });
}
