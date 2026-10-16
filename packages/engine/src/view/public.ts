import { isInCheck } from "../chess/attacks";
import type { Move } from "../chess/move";
import type { Color, Piece } from "../chess/types";
import { opponent } from "../chess/types";
import { isPublicEvent, type GameEvent, type PublicEvent } from "../mines/events";
import { liveMineCount, revealedNumbers } from "../mines/numbers";
import { settingsFromConfig } from "../mines/settings";
import type { GameState, GameStatus } from "../mines/state";
import type { EventView, FallenView, LogEntryView, MoveView, PieceView, PublicView } from "./types";

/*
 * The hidden-information boundary (design doc 3.2). Whitelist rules, enforced by lint:
 * every object below is built fresh, field by field. Nothing is spread, copied wholesale or
 * returned by reference, and `state.hidden` is never read here: the only things that
 * come from hidden state are the live numbers and the mine count, via named helpers.
 */

const pieceView = (piece: Piece): PieceView => ({ color: piece.color, type: piece.type });

const moveView = (move: Move): MoveView => ({
  from: move.from,
  to: move.to,
  piece: move.piece,
  captured: move.captured,
  captureSquare: move.captureSquare,
  promotion: move.promotion,
  castle: move.castle,
  enPassant: move.enPassant,
  doublePush: move.doublePush,
});

const statusView = (status: GameStatus): GameStatus =>
  status.kind === "ongoing"
    ? { kind: "ongoing" }
    : { kind: "over", result: status.result, reason: status.reason };

/** Rebuilds one public event from named fields. A new event type fails to compile here. */
function eventView(event: PublicEvent): EventView {
  switch (event.type) {
    case "MoveMade":
      return { type: "MoveMade", color: event.color, move: moveView(event.move) };
    case "PieceCaptured":
      return { type: "PieceCaptured", square: event.square, piece: event.piece };
    case "MineTriggered":
      return { type: "MineTriggered", square: event.square, by: pieceView(event.by) };
    case "PieceDestroyed":
      return { type: "PieceDestroyed", square: event.square, piece: pieceView(event.piece) };
    case "LifeLost":
      return {
        type: "LifeLost",
        color: event.color,
        square: event.square,
        livesLeft: event.livesLeft,
      };
    case "NumberRevealed":
      return { type: "NumberRevealed", square: event.square, number: event.number };
    case "NumbersChanged":
      return {
        type: "NumbersChanged",
        updates: event.updates.map((u) => ({ square: u.square, number: u.number })),
      };
    case "CheckExceptionTriggered":
      return { type: "CheckExceptionTriggered", color: event.color };
    case "GameOver":
      return { type: "GameOver", result: event.result, reason: event.reason };
    case "TurnPassed":
      return { type: "TurnPassed", to: event.to };
    case "Reshuffled":
      return { type: "Reshuffled", mineCount: event.mineCount };
    // M-B: Manual mine mode (3.10) events, simple pass-through for now.
    case "PlacementStarted":
      return { type: "PlacementStarted", round: event.round, quota: event.quota };
    case "PlayerReady":
      return { type: "PlayerReady", color: event.color };
    case "PlacementEnded":
      return { type: "PlacementEnded", mineCount: event.mineCount };
    case "BigMineBlasted":
      return {
        type: "BigMineBlasted",
        square: event.square,
        by: pieceView(event.by),
        area: [...event.area],
      };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

/**
 * The events a client may receive: public ones only (3.1: MineRelocated is server-only),
 * each rebuilt through the whitelist. A dropped relocation still shows up as the public
 * `NumbersChanged` the engine emits, which is by design (3.1).
 */
export function projectEvents(events: readonly GameEvent[]): EventView[] {
  return events.filter(isPublicEvent).map(eventView);
}

function fallenPieces(log: readonly LogEntryView[]): PublicView["fallen"] {
  const w: FallenView[] = [];
  const b: FallenView[] = [];
  const lost = (color: Color): FallenView[] => (color === "w" ? w : b);
  for (const entry of log) {
    for (const event of entry.events) {
      if (event.type === "PieceCaptured") {
        lost(opponent(entry.color)).push({ piece: event.piece, cause: "capture" });
      } else if (event.type === "PieceDestroyed") {
        lost(event.piece.color).push({ piece: event.piece.type, cause: "mine" });
      }
    }
  }
  return { w, b };
}

/** The client's view of a game. `viewer` is the seat it is for, or null (pass-and-play). */
export function toPublicView(state: GameState, viewer: Color | null): PublicView {
  const numbers = revealedNumbers(state);
  const log: LogEntryView[] = state.public.log.map((entry) => ({
    color: entry.color,
    events: entry.events.map(eventView),
  }));
  return {
    viewer,
    board: state.position.board.map((piece) => (piece === null ? null : pieceView(piece))),
    turn: state.position.turn,
    castling: {
      wK: state.position.castling.wK,
      wQ: state.position.castling.wQ,
      bK: state.position.castling.bK,
      bQ: state.position.castling.bQ,
    },
    enPassant: state.position.enPassant,
    fullmoveNumber: state.position.fullmoveNumber,
    lives: { w: state.public.lives.w, b: state.public.lives.b },
    revealed: [...numbers.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([square, number]) => ({ square, number })),
    craters: [...state.public.craters].sort((a, b) => a - b),
    mineCount: liveMineCount(state),
    settings: settingsFromConfig(state.config),
    turnsUntilReshuffle: Math.max(0, state.config.reshuffleInterval - state.public.noCaptureCount),
    status: statusView(state.public.status),
    checkException: state.public.checkException,
    inCheck: isInCheck(state.position),
    log,
    fallen: fallenPieces(log),
  };
}
