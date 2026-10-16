import { describe, expect, it } from "vitest";
import { createGame, createSeededRng, toPublicView } from "@chessweeper/engine";
import { parseClientMessage, serverMessageSchema, MAX_MESSAGE_CHARS } from "./index";

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

const valid: Record<string, unknown> = {
  create_room: { type: "create_room" },
  join_room: { type: "join_room", code: "ABCDEF" },
  join_room_token: { type: "join_room", code: "XYZ234", token: "abc_DEF-123" },
  move: { type: "move", seq: 0, from: 12, to: 28 },
  move_promo: { type: "move", seq: 3, from: 52, to: 60, promo: "q" },
  resign: { type: "resign" },
  draw_offer: { type: "draw_offer" },
  draw_reply: { type: "draw_reply", accept: true },
  claim_win: { type: "claim_win" },
  ping: { type: "ping" },
};

const invalid: Record<string, unknown> = {
  unknown_type: { type: "nope" },
  no_type: {},
  join_short_code: { type: "join_room", code: "ABC" },
  join_ambiguous_chars: { type: "join_room", code: "ABCDE0" },
  join_lowercase: { type: "join_room", code: "abcdef" },
  join_bad_token_chars: { type: "join_room", code: "ABCDEF", token: "a b" },
  move_no_seq: { type: "move", from: 1, to: 2 },
  move_negative_square: { type: "move", seq: 0, from: -1, to: 2 },
  move_square_64: { type: "move", seq: 0, from: 1, to: 64 },
  move_fraction: { type: "move", seq: 0, from: 1.5, to: 2 },
  move_string_square: { type: "move", seq: 0, from: "1", to: 2 },
  move_king_promo: { type: "move", seq: 0, from: 1, to: 2, promo: "k" },
  move_pawn_promo: { type: "move", seq: 0, from: 1, to: 2, promo: "p" },
  draw_reply_no_accept: { type: "draw_reply" },
  draw_reply_string: { type: "draw_reply", accept: "yes" },
};

describe("parseClientMessage", () => {
  for (const [name, value] of Object.entries(valid)) {
    it(`accepts ${name}`, () => {
      expect(parse(value).ok).toBe(true);
    });
  }
  for (const [name, value] of Object.entries(invalid)) {
    it(`rejects ${name}`, () => {
      expect(parse(value).ok).toBe(false);
    });
  }

  it("rejects unknown keys on every message type", () => {
    for (const value of Object.values(valid)) {
      expect(parse({ ...(value as object), extra: 1 }).ok).toBe(false);
    }
  });

  it("rejects oversized strings", () => {
    expect(parse({ type: "join_room", code: "ABCDEF", token: "a".repeat(65) }).ok).toBe(false);
    expect(parseClientMessage("x".repeat(MAX_MESSAGE_CHARS + 1)).ok).toBe(false);
    expect(parse({ type: "ping", pad: "x".repeat(MAX_MESSAGE_CHARS) }).ok).toBe(false);
  });

  it("never throws on junk", () => {
    for (const raw of ["", "{", "null", "[]", "42", '"str"', "\u0000", '{"type":1}']) {
      expect(parseClientMessage(raw).ok).toBe(false);
    }
  });

  it("returns the typed message", () => {
    const r = parse(valid.move_promo);
    expect(r.ok && r.message.type === "move" && r.message.promo).toBe("q");
  });
});

describe("serverMessageSchema", () => {
  const view = toPublicView(createGame({ rng: createSeededRng(1) }), "w");

  it("accepts a real snapshot", () => {
    expect(serverMessageSchema.safeParse({ type: "snapshot", seq: 0, view }).success).toBe(true);
  });

  it("rejects a view that carries extra fields (no mine leak)", () => {
    const leaky = { ...view, mines: [20] };
    expect(serverMessageSchema.safeParse({ type: "snapshot", seq: 0, view: leaky }).success).toBe(
      false,
    );
    const hidden = { ...view, hidden: {} };
    expect(serverMessageSchema.safeParse({ type: "snapshot", seq: 0, view: hidden }).success).toBe(
      false,
    );
  });

  it("rejects game_over carrying unknown fields and unknown message types", () => {
    expect(
      serverMessageSchema.safeParse({ type: "game_over", over: { view, mines: [], x: 1 } }).success,
    ).toBe(false);
    expect(serverMessageSchema.safeParse({ type: "other" }).success).toBe(false);
  });

  it("accepts small messages", () => {
    expect(serverMessageSchema.safeParse({ type: "pong" }).success).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: "error", code: "stale-seq", message: "x" }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: "error", code: "made-up", message: "x" }).success,
    ).toBe(false);
  });
});
