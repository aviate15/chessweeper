import { applyMove } from "../chess/apply";
import { isInCheck, KING_STEPS } from "../chess/attacks";
import type { Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { offsetSquare } from "../chess/square";
import type { Position, Square } from "../chess/types";
import type { GameEvent } from "./events";
import { adjacentMineCount } from "./numbers";
import type { GameState } from "./state";

/** The move is not a legal chess move in the current position. */
export class IllegalMoveError extends Error {
  constructor() {
    super("Illegal move");
    this.name = "IllegalMoveError";
  }
}

/**
 * A situation whose rules belong to a later milestone. The engine refuses it loudly
 * instead of guessing (CLAUDE.md: never invent a rule).
 */
export class NotYetSupportedError extends Error {
  constructor(what: string) {
    super(`Not supported yet: ${what}`);
    this.name = "NotYetSupportedError";
  }
}

export interface Resolution {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * Plays one ordinary move or capture and resolves its landing (design doc 3.8 steps 1-4):
 * - a surviving piece reveals its square (3.2), craters included;
 * - a live mine destroys a non-king piece, is consumed and leaves a crater; the move is
 *   wasted and the turn passes (3.4);
 * - a king on a live mine loses one life, consumes the mine and stays (3.6);
 * - captures never hit mines (3.5).
 * Immutable: returns a new state and the events, leaving the input untouched.
 */
export function resolveMove(state: GameState, move: Move): Resolution {
  const legal = legalMoves(state.position).find(
    (m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion,
  );
  if (legal === undefined) throw new IllegalMoveError();

  // Rules for these arrive in later milestones.
  if (legal.castle !== null || legal.enPassant || legal.promotion !== null) {
    throw new NotYetSupportedError("castling, en passant and promotion (M6)");
  }
  if (state.public.lives.w === 0 || state.public.lives.b === 0) {
    throw new NotYetSupportedError("moves after a king has lost its last life");
  }

  const to = legal.to;
  const moved = applyMove(state.position, legal);
  const landed = moved.board[to];
  if (landed == null) throw new Error("Moving piece missing after applyMove");
  const mover = landed.color;
  const events: GameEvent[] = [{ type: "MoveMade", color: mover, move: legal }];
  if (legal.captured !== null && legal.captureSquare !== null) {
    events.push({ type: "PieceCaptured", square: legal.captureSquare, piece: legal.captured });
  }

  const mines = new Set(state.hidden.mines);
  const craters = new Set(state.public.craters);
  const revealed = new Set(state.public.revealed);
  let lives = state.public.lives;
  let position: Position = moved;

  if (!mines.has(to)) {
    // Survived: reveal the square (3.2). Revealing a 0 reveals only itself (no flood fill).
    if (!revealed.has(to)) {
      revealed.add(to);
      events.push({ type: "NumberRevealed", square: to, number: adjacentMineCount(mines, to) });
    }
  } else {
    if (legal.captured !== null) throw new Error("Invariant violated: a mine under a piece");
    mines.delete(to);
    craters.add(to);
    events.push({ type: "MineTriggered", square: to, by: landed });

    if (landed.type === "k") {
      // 3.6: lose one life, the mine is consumed, the king stays and so survives the landing.
      const livesLeft = lives[mover] - 1;
      lives = { ...lives, [mover]: livesLeft };
      events.push({ type: "LifeLost", color: mover, square: to, livesLeft });
      revealed.add(to);
      events.push({ type: "NumberRevealed", square: to, number: adjacentMineCount(mines, to) });
    } else {
      // 3.4: the piece is destroyed and the move wasted. A destroyed double-pushed pawn
      // sets no en passant target.
      const board = moved.board.slice();
      board[to] = null;
      position = { ...moved, board, enPassant: null };
      events.push({ type: "PieceDestroyed", square: to, piece: landed });
      if (isInCheck(position, mover)) {
        throw new NotYetSupportedError("check exception after an explosion");
      }
    }

    // Revealed numbers are live: neighbours of the consumed mine drop by one (3.2).
    const updates = revealedNeighbours(state.public.revealed, to).map((square) => ({
      square,
      number: adjacentMineCount(mines, square),
    }));
    if (updates.length > 0) events.push({ type: "NumbersChanged", updates });
  }

  events.push({ type: "TurnPassed", to: position.turn });
  return {
    state: {
      ...state,
      position,
      public: { ...state.public, revealed, craters, lives },
      hidden: { mines },
    },
    events,
  };
}

function revealedNeighbours(revealed: ReadonlySet<Square>, square: Square): Square[] {
  const result: Square[] = [];
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && revealed.has(neighbour)) result.push(neighbour);
  }
  return result;
}
