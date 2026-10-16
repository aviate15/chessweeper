import type { EventView, MoveView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { fxEndMs, MAX_BLOCKING_MS, presentationFor } from "./presentation";

const move = (over: Partial<MoveView> = {}): MoveView => ({
  from: 12,
  to: 28,
  piece: "p",
  captured: null,
  captureSquare: null,
  promotion: null,
  castle: null,
  enPassant: false,
  doublePush: true,
  ...over,
});
const made = (m: MoveView): EventView => ({ type: "MoveMade", color: "w", move: m });
const on = { reducedMotion: false };
const off = { reducedMotion: true };

describe("presentationFor", () => {
  it("slides a quiet move and does not block", () => {
    const p = presentationFor([made(move()), { type: "TurnPassed", to: "b" }], on);
    expect(p.blockingMs).toBe(0);
    expect(p.fx).toEqual([expect.objectContaining({ kind: "slide", from: 12, to: 28 })]);
  });

  it("pops a captured piece in the opponent's colour, on the en passant square", () => {
    const ep = move({ captured: "p", captureSquare: 36, enPassant: true, to: 44 });
    const p = presentationFor([made(ep)], on);
    expect(p.fx).toContainEqual(
      expect.objectContaining({ kind: "capture", square: 36, piece: { color: "b", type: "p" } }),
    );
  });

  it("flips a revealed number", () => {
    const p = presentationFor(
      [made(move()), { type: "NumberRevealed", square: 28, number: 2 }],
      on,
    );
    expect(p.fx).toContainEqual(expect.objectContaining({ kind: "flip", square: 28 }));
  });

  it("explodes on a mine: no slide for the destroyed piece, blocking within the cap", () => {
    const events: EventView[] = [
      made(move()),
      { type: "MineTriggered", square: 28, by: { color: "w", type: "p" } },
      { type: "PieceDestroyed", square: 28, piece: { color: "w", type: "p" } },
    ];
    const p = presentationFor(events, on);
    expect(p.fx.some((f) => f.kind === "slide")).toBe(false);
    expect(p.fx).toContainEqual(expect.objectContaining({ kind: "explosion", square: 28 }));
    expect(p.blockingMs).toBeGreaterThan(0);
    expect(p.blockingMs).toBeLessThanOrEqual(MAX_BLOCKING_MS);
  });

  it("cracks a king life and still slides the king that survived", () => {
    const events: EventView[] = [
      made(move({ piece: "k" })),
      { type: "MineTriggered", square: 28, by: { color: "w", type: "k" } },
      { type: "LifeLost", color: "w", square: 28, livesLeft: 2 },
    ];
    const p = presentationFor(events, on);
    expect(p.fx).toContainEqual(expect.objectContaining({ kind: "lifeCrack", color: "w" }));
    expect(p.fx).toContainEqual(expect.objectContaining({ kind: "slide" }));
    expect(p.blockingMs).toBeGreaterThan(0);
  });

  it("slides the rook when castling", () => {
    const p = presentationFor([made(move({ from: 4, to: 6, castle: "king" }))], on);
    expect(p.fx).toContainEqual(expect.objectContaining({ kind: "slide", from: 7, to: 5 }));
    const q = presentationFor([made(move({ from: 60, to: 58, castle: "queen" }))], on);
    expect(q.fx).toContainEqual(expect.objectContaining({ kind: "slide", from: 56, to: 59 }));
  });

  it("caps blocking for a long chain of mines", () => {
    const hits: EventView[] = [0, 1, 2, 3, 4, 5].map((i) => ({
      type: "MineTriggered",
      square: 20 + i,
      by: { color: "w", type: "n" },
    }));
    expect(presentationFor(hits, on).blockingMs).toBe(MAX_BLOCKING_MS);
  });

  it("adds a reshuffle wave, a game-over reveal and a check flash", () => {
    const p = presentationFor(
      [
        { type: "Reshuffled", mineCount: 8 },
        { type: "GameOver", result: "w", reason: "resignation" },
      ],
      { reducedMotion: false, checkSquare: 4, mineCount: 8 },
    );
    expect(p.fx.map((f) => f.kind)).toEqual(["reshuffle", "mineReveal", "check"]);
    expect(fxEndMs(p.fx)).toBeGreaterThan(0);
  });

  it("disables every effect and the gate under reduced motion", () => {
    const events: EventView[] = [
      made(move()),
      { type: "MineTriggered", square: 28, by: { color: "w", type: "p" } },
      { type: "LifeLost", color: "w", square: 28, livesLeft: 1 },
      { type: "Reshuffled", mineCount: 8 },
    ];
    expect(presentationFor(events, { ...off, checkSquare: 4 })).toEqual({ blockingMs: 0, fx: [] });
  });
});
