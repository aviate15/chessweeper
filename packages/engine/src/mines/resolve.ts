import { applyMove } from "../chess/apply";
import { castleRookSquares, type Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import type { Piece } from "../chess/types";
import type { Rng } from "./rng";
import type { GameEvent } from "./events";
import { nextNoCaptureCount } from "./counter";
import { finishTurn } from "./endturn";
import { resolveLanding, type Working } from "./landing";
import { reshuffle } from "./reshuffle";
import { relocateSafeStartMine } from "./safestart";
import type { GameState } from "./state";

/** The move is not a legal chess move in the current position. */
export class IllegalMoveError extends Error {
  constructor() {
    super("Illegal move");
    this.name = "IllegalMoveError";
  }
}

/** The game has already ended (design doc 3.6), so no further moves are accepted. */
export class GameOverError extends Error {
  constructor() {
    super("The game is over");
    this.name = "GameOverError";
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
export function resolveMove(state: GameState, move: Move, rng: Rng): Resolution {
  if (state.public.status.kind === "over") throw new GameOverError();
  const legal = legalMoves(state.position).find(
    (m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion,
  );
  if (legal === undefined) throw new IllegalMoveError();

  const origin = state.position.board[legal.from];
  if (origin == null) throw new Error("No piece on the move origin");
  const mover = origin.color;
  const moved = applyMove(state.position, legal);

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

  // 3.1 safe start: a side's very first move of the game cannot hit a mine, so a mine under
  // its landing square is moved away before the landing resolves. The flag is spent either way.
  const safeStart = { ...state.hidden.safeStart };
  if (safeStart[mover]) {
    if (work.mines.has(legal.to)) relocateSafeStartMine(work, legal.to, rng);
    safeStart[mover] = false;
  }

  // Landings resolve in order: the moving piece, then (castling only) the rook. A king
  // that loses its last life ends the game, so nothing after that landing resolves.
  // The landing piece is the original one, so a pawn on a mined promotion square dies as a
  // pawn and does not promote (3.5).
  const landings: { square: number; piece: Piece; isCapture: boolean }[] = [
    { square: legal.to, piece: origin, isCapture: legal.captureSquare === legal.to },
  ];
  const rook = castleRookSquares(legal);
  if (rook !== null) {
    landings.push({ square: rook.to, piece: { color: mover, type: "r" }, isCapture: false });
  }
  let destroyed = false;
  for (const landing of landings) {
    if (resolveLanding(work, landing.square, landing.piece, landing.isCapture) === "destroyed") {
      destroyed = true;
    }
    if (work.lives[mover] === 0) break;
  }

  const end = finishTurn({ before: state.position, moved, work, move: legal, mover, destroyed });
  // 3.7, 3.8 step 8: only a completed turn in a game that goes on counts. A pending chain
  // and the game-ending turn leave the counter alone, and neither can trigger a reshuffle.
  let noCaptureCount = state.public.noCaptureCount;
  if (end.status.kind === "ongoing" && end.checkException === null) {
    noCaptureCount = nextNoCaptureCount(noCaptureCount, legal.captured !== null);
    if (noCaptureCount >= state.config.reshuffleInterval) {
      reshuffle(work, end.position.board, state.config, rng);
      noCaptureCount = 0;
    }
  }

  return {
    state: {
      ...state,
      position: end.position,
      public: {
        ...state.public,
        revealed: work.revealed,
        craters: work.craters,
        lives: { w: work.lives.w, b: work.lives.b },
        status: end.status,
        checkException: end.checkException,
        noCaptureCount,
      },
      hidden: { mines: work.mines, safeStart },
    },
    events: work.events,
  };
}
