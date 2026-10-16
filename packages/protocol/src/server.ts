import type {
  EventView as EngineEventView,
  GameOverView as EngineGameOverView,
  GameSettings as EngineGameSettings,
  LogEntryView as EngineLogEntryView,
  PublicView as EnginePublicView,
} from "@chessweeper/engine";
import { z } from "zod";
import { CODE_ALPHABET, CODE_LENGTH, MAX_TOKEN_CHARS } from "./client";
import { ERROR_CODES, type ErrorCode } from "./errors";

/** Server to client messages. Everything game-related is an engine projection (design doc 3.2). */
export type ServerMessage =
  | {
      readonly type: "joined";
      readonly code: string;
      readonly seat: "w" | "b";
      readonly token: string;
      readonly settings: GameSettings;
    }
  | { readonly type: "snapshot"; readonly seq: number; readonly view: PublicView }
  | {
      readonly type: "update";
      readonly seq: number;
      readonly events: readonly EventView[];
      readonly view: PublicView;
    }
  | { readonly type: "opponent"; readonly state: "connected" | "disconnected" | "claimable" }
  | { readonly type: "draw"; readonly state: "offered" | "declined" | "lapsed" }
  | { readonly type: "error"; readonly code: ErrorCode; readonly message: string }
  | { readonly type: "game_over"; readonly over: GameOverView }
  | { readonly type: "pong" }
  /** Placement round start / snapshot: clients derive the countdown from msLeft (manual mode). */
  | { readonly type: "placement"; readonly round: number; readonly msLeft: number };

/**
 * Manual mine mode additions (design doc 3.10) that the engine types do not export yet.
 * TODO(reconcile with engine): replace with the engine's Phase, PublicView.placement,
 * GameSettings.mode, EventView variants and GameOverView.owned once they exist.
 */
export type GameMode = "auto" | "manual";
export type EventView = EngineEventView | PlacementEventView;
export interface LogEntryView extends Omit<EngineLogEntryView, "events"> {
  readonly events: readonly EventView[];
}
export type GameSettings = EngineGameSettings & { readonly mode?: GameMode | undefined };
export type PublicView = Omit<EnginePublicView, "log" | "settings"> & {
  readonly log: readonly LogEntryView[];
  readonly settings: GameSettings;
  readonly phase?: PhaseView | undefined;
  readonly placement?: PlacementView | null | undefined;
};
export type GameOverView = Omit<EngineGameOverView, "view"> & {
  readonly view: PublicView;
  readonly owned?: OwnedMines | null | undefined;
};
export type PhaseView =
  | { readonly kind: "play" }
  | {
      readonly kind: "placement";
      readonly round: number;
      readonly quota: number;
      readonly ready: { readonly w: boolean; readonly b: boolean };
    };
export interface PlacementView {
  readonly quota: number;
  readonly ready: { readonly w: boolean; readonly b: boolean };
  /** The viewer's own draft; null for spectators. */
  readonly own: readonly number[] | null;
}
export type PlacementEventView =
  | { readonly type: "PlacementStarted"; readonly round: number; readonly quota: number }
  | { readonly type: "PlayerReady"; readonly color: "w" | "b" }
  | { readonly type: "PlacementEnded"; readonly mineCount: number }
  | {
      readonly type: "BigMineBlasted";
      readonly square: number;
      readonly by: { readonly color: "w" | "b"; readonly type: "p" | "n" | "b" | "r" | "q" | "k" };
      readonly area: readonly number[];
    }
  | { readonly type: "MinesAutoPlaced"; readonly color: "w" | "b"; readonly count: number };
export interface OwnedMines {
  readonly w: readonly number[];
  readonly b: readonly number[];
}

const color = z.enum(["w", "b"]);
const pieceType = z.enum(["p", "n", "b", "r", "q", "k"]);
const promotion = z.enum(["n", "b", "r", "q"]);
const square = z.number().int().min(0).max(63);
const count = z.number().int().min(0);
const mineNumber = z.number().int().min(0).max(8);

const pieceView = z.strictObject({ color, type: pieceType });
const moveView = z.strictObject({
  from: square,
  to: square,
  piece: pieceType,
  captured: pieceType.nullable(),
  captureSquare: square.nullable(),
  promotion: promotion.nullable(),
  castle: z.enum(["king", "queen"]).nullable(),
  enPassant: z.boolean(),
  doublePush: z.boolean(),
});
const numberView = z.strictObject({ square, number: mineNumber });
const result = z.enum(["w", "b", "draw"]);
const reason = z.enum([
  "king-lives",
  "checkmate",
  "stalemate",
  "resignation",
  "agreement",
  "abandonment",
]);

const eventView = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("MoveMade"), color, move: moveView }),
  z.strictObject({ type: z.literal("PieceCaptured"), square, piece: pieceType }),
  z.strictObject({ type: z.literal("MineTriggered"), square, by: pieceView }),
  z.strictObject({ type: z.literal("PieceDestroyed"), square, piece: pieceView }),
  z.strictObject({ type: z.literal("LifeLost"), color, square, livesLeft: count }),
  z.strictObject({ type: z.literal("NumberRevealed"), square, number: mineNumber }),
  z.strictObject({ type: z.literal("NumbersChanged"), updates: z.array(numberView) }),
  z.strictObject({ type: z.literal("CheckExceptionTriggered"), color }),
  z.strictObject({ type: z.literal("GameOver"), result, reason }),
  z.strictObject({ type: z.literal("TurnPassed"), to: color }),
  z.strictObject({ type: z.literal("Reshuffled"), mineCount: count }),
  z.strictObject({ type: z.literal("PlacementStarted"), round: count, quota: count }),
  z.strictObject({ type: z.literal("PlayerReady"), color }),
  z.strictObject({ type: z.literal("PlacementEnded"), mineCount: count }),
  z.strictObject({
    type: z.literal("BigMineBlasted"),
    square,
    by: pieceView,
    area: z.array(square).max(64),
  }),
  // Seat-private: the server only sends this to the colour it names.
  z.strictObject({ type: z.literal("MinesAutoPlaced"), color, count }),
]);

const settings = z.strictObject({
  reshuffleInterval: z.number().int().min(1),
  densityPercent: z.number().int().min(0).max(100),
  // TODO(reconcile with engine): required once the engine's GameSettings carries mode.
  mode: z.enum(["auto", "manual"]).optional(),
});

const ready = z.strictObject({ w: z.boolean(), b: z.boolean() });
const phase = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("play") }),
  z.strictObject({ kind: z.literal("placement"), round: count, quota: count, ready }),
]);
const placement = z.strictObject({
  quota: count,
  ready,
  own: z.array(square).max(64).nullable(),
});

const fallen = z.array(z.strictObject({ piece: pieceType, cause: z.enum(["capture", "mine"]) }));

const publicView = z.strictObject({
  viewer: color.nullable(),
  board: z.array(pieceView.nullable()).length(64),
  turn: color,
  castling: z.strictObject({
    wK: z.boolean(),
    wQ: z.boolean(),
    bK: z.boolean(),
    bQ: z.boolean(),
  }),
  enPassant: square.nullable(),
  fullmoveNumber: z.number().int().min(1),
  lives: z.strictObject({ w: count, b: count }),
  revealed: z.array(numberView),
  craters: z.array(square),
  mineCount: count,
  settings,
  turnsUntilReshuffle: count,
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("ongoing") }),
    z.strictObject({ kind: z.literal("over"), result, reason }),
  ]),
  checkException: color.nullable(),
  inCheck: z.boolean(),
  log: z.array(z.strictObject({ color, events: z.array(eventView) })),
  fallen: z.strictObject({ w: fallen, b: fallen }),
  // TODO(reconcile with engine): required once PublicView carries phase/placement.
  phase: phase.optional(),
  placement: placement.nullable().optional(),
});

/**
 * Strict schema for every frame the server may send. Unknown keys fail, so a field such as
 * `mines` or `hidden` on a running game cannot pass. Used by tests to validate each frame.
 */
export const serverMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("joined"),
    code: z
      .string()
      .length(CODE_LENGTH)
      .regex(new RegExp(`^[${CODE_ALPHABET}]+$`)),
    seat: color,
    token: z.string().min(1).max(MAX_TOKEN_CHARS),
    settings,
  }),
  z.strictObject({ type: z.literal("snapshot"), seq: count, view: publicView }),
  z.strictObject({
    type: z.literal("update"),
    seq: count,
    events: z.array(eventView),
    view: publicView,
  }),
  z.strictObject({
    type: z.literal("opponent"),
    state: z.enum(["connected", "disconnected", "claimable"]),
  }),
  z.strictObject({ type: z.literal("draw"), state: z.enum(["offered", "declined", "lapsed"]) }),
  z.strictObject({
    type: z.literal("error"),
    code: z.enum(ERROR_CODES),
    message: z.string().max(100),
  }),
  z.strictObject({
    type: z.literal("game_over"),
    over: z.strictObject({
      view: publicView,
      mines: z.array(square),
      // Who placed each mine (Manual mine, 3.10); omitted in Auto. Sent only at game over.
      owned: z.strictObject({ w: z.array(square), b: z.array(square) }).optional(),
    }),
  }),
  z.strictObject({ type: z.literal("pong") }),
  z.strictObject({ type: z.literal("placement"), round: count, msLeft: count }),
]);
