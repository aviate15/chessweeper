import type { EventView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { cuesFor } from "./cues";

const move = (captured: "p" | null = null): EventView => ({
  type: "MoveMade",
  color: "w",
  move: {
    from: 12,
    to: 28,
    piece: "p",
    captured,
    captureSquare: captured ? 28 : null,
    promotion: null,
    castle: null,
    enPassant: false,
    doublePush: false,
  },
});
const reveal: EventView = { type: "NumberRevealed", square: 28, number: 2 };
const boom: EventView = { type: "PieceDestroyed", square: 28, piece: { color: "w", type: "n" } };
const life: EventView = { type: "LifeLost", color: "w", square: 28, livesLeft: 2 };
const check: EventView = { type: "CheckExceptionTriggered", color: "w" };
const shuffle: EventView = { type: "Reshuffled", mineCount: 8 };
const over: EventView = { type: "GameOver", result: "b", reason: "checkmate" };

describe("cuesFor", () => {
  it("maps simple events", () => {
    expect(cuesFor([move()])).toEqual(["move"]);
    expect(cuesFor([move(), reveal])).toEqual(["reveal"]);
    expect(cuesFor([move("p")])).toEqual(["capture"]);
    expect(cuesFor([{ type: "PieceCaptured", square: 28, piece: "p" }])).toEqual(["capture"]);
    expect(cuesFor([])).toEqual([]);
  });

  it("orders by priority: gameOver > kingHit > explosion > capture > check > reveal > move", () => {
    expect(cuesFor([move("p"), boom])).toEqual(["explosion"]);
    expect(cuesFor([move(), boom, life])).toEqual(["kingHit"]);
    expect(cuesFor([move(), boom, life, over])).toEqual(["gameOver"]);
    expect(cuesFor([move(), reveal, check])).toEqual(["check"]);
  });

  it("adds check or reshuffle as a second cue, capped at two", () => {
    expect(cuesFor([move(), boom, check])).toEqual(["explosion", "check"]);
    expect(cuesFor([move(), reveal, shuffle])).toEqual(["reveal", "reshuffle"]);
    expect(cuesFor([move(), boom, check, shuffle])).toEqual(["explosion", "check"]);
    expect(cuesFor([shuffle])).toEqual(["reshuffle"]);
  });

  it("deduplicates and is stable", () => {
    expect(cuesFor([boom, boom, move(), boom])).toEqual(["explosion"]);
    const evs = [move("p"), reveal, check, shuffle];
    expect(cuesFor(evs)).toEqual(cuesFor(evs));
  });
});
