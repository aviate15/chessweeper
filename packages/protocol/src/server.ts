import type { EventView, GameOverView, GameSettings, PublicView } from "@chessweeper/engine";
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
  | { readonly type: "pong" };

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
]);

const settings = z.strictObject({
  reshuffleInterval: z.number().int().min(1),
  densityPercent: z.number().int().min(0).max(100),
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
    over: z.strictObject({ view: publicView, mines: z.array(square) }),
  }),
  z.strictObject({ type: z.literal("pong") }),
]);
