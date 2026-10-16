import { describe, expect, it } from "vitest";
import { createGame, createSeededRng, toPublicView } from "@chessweeper/engine";
import { ERROR_CODES, MAX_MESSAGE_CHARS, parseClientMessage, serverMessageSchema } from "./index";

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe("manual mode client messages", () => {
  it("round-trips place, unplace, placement_done", () => {
    for (const m of [
      { type: "place", sq: 0 },
      { type: "unplace", sq: 63 },
      { type: "placement_done" },
    ]) {
      expect(parse(m)).toEqual({ ok: true, message: m });
    }
  });
  it("rejects unknown keys and bad squares", () => {
    for (const m of [
      { type: "place", sq: 64 },
      { type: "place", sq: -1 },
      { type: "place", sq: 1.5 },
      { type: "place", sq: "3" },
      { type: "place" },
      { type: "unplace", sq: 3, extra: 1 },
      { type: "placement_done", sq: 3 },
    ]) {
      expect(parse(m).ok).toBe(false);
    }
  });
  it("accepts create_room mode and rejects unknown modes", () => {
    const base = { reshuffleInterval: 10, densityPercent: 30 };
    const r = parse({ type: "create_room", settings: { ...base, mode: "manual" } });
    expect(r.ok && r.message.type === "create_room" && r.message.settings).toMatchObject({
      reshuffleInterval: 10,
    });
    expect(parse({ type: "create_room", settings: { ...base, mode: "auto" } }).ok).toBe(true);
    expect(parse({ type: "create_room", settings: { ...base, mode: "chaos" } }).ok).toBe(false);
    expect(parse({ type: "create_room", settings: { ...base, mode: null } }).ok).toBe(false);
  });
  it("still clamps out-of-range numbers alongside mode", () => {
    const r = parse({
      type: "create_room",
      settings: { reshuffleInterval: 999, densityPercent: 999, mode: "manual" },
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.message.type === "create_room") {
      expect(r.message.settings?.reshuffleInterval).toBeLessThanOrEqual(20);
      expect(r.message.settings?.densityPercent).toBeLessThanOrEqual(50);
      // TODO(reconcile with engine): assert settings.mode === "manual" once clampSettings carries it.
    }
  });
  it("still enforces the frame size cap", () => {
    const big = JSON.stringify({ type: "ping", pad: "x".repeat(MAX_MESSAGE_CHARS) });
    expect(parseClientMessage(big).ok).toBe(false);
    expect(parseClientMessage(" ".repeat(MAX_MESSAGE_CHARS) + '{"type":"ping"}').ok).toBe(false);
  });
});

describe("manual mode server messages", () => {
  const view = toPublicView(createGame({ rng: createSeededRng(1) }), "w");
  const ok = (m: unknown) => serverMessageSchema.safeParse(m).success;

  it("accepts the placement message and rejects malformed ones", () => {
    expect(ok({ type: "placement", round: 1, msLeft: 20000 })).toBe(true);
    expect(ok({ type: "placement", round: 1 })).toBe(false);
    expect(ok({ type: "placement", round: 1, msLeft: -1 })).toBe(false);
    expect(ok({ type: "placement", round: 1, msLeft: 5, extra: 1 })).toBe(false);
  });
  it("accepts the new event variants in an update and rejects bad ones", () => {
    const events = [
      { type: "PlacementStarted", round: 1, quota: 5 },
      { type: "PlayerReady", color: "w" },
      { type: "PlacementEnded", mineCount: 10 },
      { type: "BigMineBlasted", square: 28, by: { color: "w", type: "q" }, area: [27, 28, 29] },
      { type: "MinesAutoPlaced", color: "b", count: 2 },
    ];
    expect(ok({ type: "update", seq: 1, events, view })).toBe(true);
    for (const bad of [
      { type: "PlayerReady", color: "x" },
      { type: "PlacementStarted", round: 1 },
      { type: "BigMineBlasted", square: 64, by: { color: "w", type: "q" }, area: [] },
      { type: "MinesAutoPlaced", color: "b", count: 2, mines: [1] },
    ]) {
      expect(ok({ type: "update", seq: 1, events: [bad], view })).toBe(false);
    }
  });
  it("validates view phase, placement and settings.mode", () => {
    const placing = {
      ...view,
      settings: { ...view.settings, mode: "manual" },
      phase: { kind: "placement", round: 1, quota: 5, ready: { w: false, b: true } },
      placement: { quota: 5, ready: { w: false, b: true }, own: [20, 21] },
    };
    const snap = (v: unknown) => ({ type: "snapshot", seq: 0, view: v });
    expect(ok(snap(placing))).toBe(true);
    expect(ok(snap({ ...placing, placement: null }))).toBe(true);
    expect(ok(snap({ ...placing, phase: { kind: "x" } }))).toBe(false);
    expect(ok(snap({ ...placing, placement: { ...placing.placement, own: [64] } }))).toBe(false);
    expect(ok(snap({ ...placing, settings: { ...placing.settings, mode: "z" } }))).toBe(false);
  });
  it("validates game_over owned", () => {
    const over = { view, mines: [1, 2] };
    expect(ok({ type: "game_over", over })).toBe(true);
    expect(ok({ type: "game_over", over: { ...over, owned: null } })).toBe(true);
    expect(ok({ type: "game_over", over: { ...over, owned: { w: [1], b: [2] } } })).toBe(true);
    expect(ok({ type: "game_over", over: { ...over, owned: { w: [64], b: [] } } })).toBe(false);
    expect(ok({ type: "game_over", over: { ...over, owned: { w: [1] } } })).toBe(false);
  });
  it("lists the new error codes", () => {
    for (const c of ["not-placing", "quota-full", "bad-square", "already-ready"]) {
      expect(ERROR_CODES).toContain(c);
      expect(ok({ type: "error", code: c, message: "x" })).toBe(true);
    }
  });
});
