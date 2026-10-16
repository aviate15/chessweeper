import { createGame, createSeededRng, toPublicView, type PublicView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { handoffAfterMove } from "./handoff";

const base = toPublicView(createGame({ rng: createSeededRng(1) }), null);

describe("handoffAfterMove", () => {
  it("hands over when the turn passes to the other colour", () => {
    const view: PublicView = { ...base, turn: "b" };
    expect(handoffAfterMove("w", view)).toBe("b");
  });

  it("does not hand over mid check-exception chain (3.4): the same side moves again", () => {
    const view: PublicView = { ...base, turn: "w", checkException: "w" };
    expect(handoffAfterMove("w", view)).toBeNull();
  });

  it("does not hand over when the game is over", () => {
    const view: PublicView = {
      ...base,
      turn: "b",
      status: { kind: "over", result: "w", reason: "checkmate" },
    };
    expect(handoffAfterMove("w", view)).toBeNull();
  });
});
