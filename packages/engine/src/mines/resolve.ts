import { applyMove } from "../chess/apply";
import { isInCheck } from "../chess/attacks";
import type { Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import type { Position } from "../chess/types";
import type { GameEvent } from "./events";
import { resolveLanding, type Working } from "./landing";
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

  const work: Working = {
    board: moved.board.slice(),
    mines: new Set(state.hidden.mines),
    craters: new Set(state.public.craters),
    revealed: new Set(state.public.revealed),
    lives: { ...state.public.lives },
    events: [{ type: "MoveMade", color: mover, move: legal }],
  };
  if (legal.captured !== null && legal.captureSquare !== null) {
    work.events.push({ type: "PieceCaptured", square: legal.captureSquare, piece: legal.captured });
  }

  let position: Position = moved;
  const outcome = resolveLanding(work, to, landed, legal.captured !== null);
  if (outcome === "destroyed") {
    // 3.4: the move is wasted. A destroyed double-pushed pawn sets no en passant target.
    position = { ...moved, board: work.board, enPassant: null };
    if (isInCheck(position, mover)) {
      throw new NotYetSupportedError("check exception after an explosion");
    }
  }

  work.events.push({ type: "TurnPassed", to: position.turn });
  return {
    state: {
      ...state,
      position,
      public: {
        ...state.public,
        revealed: work.revealed,
        craters: work.craters,
        lives: { w: work.lives.w, b: work.lives.b },
      },
      hidden: { mines: work.mines },
    },
    events: work.events,
  };
}
