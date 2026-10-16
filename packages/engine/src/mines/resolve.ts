import { applyMove } from "../chess/apply";
import { castleRookSquares, type Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import type { Piece } from "../chess/types";
import type { Rng } from "./rng";
import { isPublicEvent, type GameEvent } from "./events";
import { nextNoCaptureCount } from "./counter";
import { finishTurn } from "./endturn";
import { resolveLanding, type Working } from "./landing";
import { placementPhase } from "./placement";
import { reshuffle } from "./reshuffle";
import { relocateSafeStartMine } from "./safestart";
import type { GameState, Phase } from "./state";

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

/** Manual mine mode (design doc 3.10): no moves are accepted during a placement phase. */
export class PlacementInProgressError extends Error {
  constructor() {
    super("Mines are being placed");
    this.name = "PlacementInProgressError";
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
 * - captures never hit mines (3.5);
 * - a big mine (Manual mode) blasts its 3x3 area (3.10).
 * Immutable: returns a new state and the events, leaving the input untouched.
 */
export function resolveMove(state: GameState, move: Move, rng: Rng): Resolution {
  if (state.public.status.kind === "over") throw new GameOverError();
  if (state.public.phase.kind === "placement") throw new PlacementInProgressError();
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
    owned:
      state.hidden.owned == null
        ? null
        : { w: new Set(state.hidden.owned.w), b: new Set(state.hidden.owned.b) },
    craters: new Set(state.public.craters),
    revealed: new Set(state.public.revealed),
    lives: { ...state.public.lives },
    events: [{ type: "MoveMade", color: mover, move: legal }],
    moverLost: false,
  };
  if (legal.captured !== null && legal.captureSquare !== null) {
    work.events.push({ type: "PieceCaptured", square: legal.captureSquare, piece: legal.captured });
  }

  // 3.1 safe start: a side's very first move of the game cannot hit a mine, so a mine under
  // its landing square is moved away before the landing resolves. The flag is spent either way.
  // (Manual mode has no safe start, 3.10: its flags start spent.)
  const safeStart = { ...state.hidden.safeStart };
  if (safeStart[mover]) {
    if (work.mines.has(legal.to)) relocateSafeStartMine(work, legal.to, rng);
    safeStart[mover] = false;
  }

  // Landings resolve in order: the moving piece, then (castling only) the rook. A king
  // that loses its last life ends the game, so nothing after that landing resolves.
  // The landing piece is the original one, so a pawn on a mined promotion square dies as a
  // pawn and does not promote (3.5).
  // 3.10: castling lands the king first while the rook is still on its home square, so a
  // big mine blast at the king's landing can destroy the rook there, and then the rook
  // move does not happen. Otherwise the rook moves and lands.
  const rook = castleRookSquares(legal);
  const rookPiece: Piece = { color: mover, type: "r" };
  if (rook !== null) {
    work.board[rook.to] = null;
    work.board[rook.from] = rookPiece;
  }
  let destroyed =
    resolveLanding(work, legal.to, origin, legal.captureSquare === legal.to) === "destroyed";
  if (rook !== null && work.board[rook.from] != null) {
    work.board[rook.from] = null;
    work.board[rook.to] = rookPiece;
    if (work.lives[mover] > 0 && resolveLanding(work, rook.to, rookPiece, false) === "destroyed") {
      destroyed = true;
    }
  }
  destroyed = destroyed || work.moverLost === true;

  const end = finishTurn({ before: state.position, moved, work, move: legal, mover, destroyed });
  // 3.7, 3.8 step 8: only a completed turn in a game that goes on counts. A pending chain
  // and the game-ending turn leave the counter alone, and neither can trigger a reshuffle.
  // A capture earlier in a check-exception chain still makes this a capture turn. Blast
  // kills are not captures (3.10).
  const captured = state.hidden.chainCaptured || legal.captured !== null;
  let noCaptureCount = state.public.noCaptureCount;
  let round = state.hidden.placementRound ?? 0;
  let nextPhase: Phase | null = null;
  if (end.status.kind === "ongoing" && end.checkException === null) {
    noCaptureCount = nextNoCaptureCount(noCaptureCount, captured);
    if (noCaptureCount >= state.config.reshuffleInterval) {
      if (state.config.mode === "manual") {
        // 3.10: clear mines, craters and revealed numbers (3.7), then both players place anew.
        round = (state.hidden.placementRound ?? 0) + 1;
        const phase = placementPhase(end.position.board, state.config, round);
        nextPhase = phase;
        work.mines.clear();
        work.owned = { w: new Set(), b: new Set() };
        work.craters.clear();
        work.revealed.clear();
        work.events.push({ type: "Reshuffled", mineCount: 0 });
        work.events.push({ type: "PlacementStarted", round, quota: phase.quota });
      } else {
        reshuffle(work, end.position.board, state.config, rng);
      }
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
        phase: nextPhase ?? state.public.phase,
        log: [...state.public.log, { color: mover, events: work.events.filter(isPublicEvent) }],
      },
      hidden: {
        mines: work.mines,
        safeStart,
        chainCaptured: end.checkException !== null && captured,
        owned: work.owned ?? null,
        drafts: nextPhase === null ? (state.hidden.drafts ?? null) : { w: new Set(), b: new Set() },
        autoPlaced: nextPhase === null ? (state.hidden.autoPlaced ?? null) : null,
        placementRound: round,
      },
    },
    events: work.events,
  };
}
