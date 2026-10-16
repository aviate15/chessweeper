import type { EventView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { narrate } from "./narration";

const knightMove = {
  from: 6,
  to: 28,
  piece: "n",
  captured: null,
  captureSquare: null,
  promotion: null,
  castle: null,
  enPassant: false,
  doublePush: false,
} as const;

describe("narrate", () => {
  it("narrates a plain move", () => {
    const events: EventView[] = [{ type: "MoveMade", color: "w", move: knightMove }];
    expect(narrate(events)).toBe("White's knight moved to e4");
  });

  it("narrates a mine hit once, not as a move", () => {
    const events: EventView[] = [
      { type: "MoveMade", color: "w", move: knightMove },
      { type: "MineTriggered", square: 28, by: { color: "w", type: "n" } },
      { type: "PieceDestroyed", square: 28, piece: { color: "w", type: "n" } },
      { type: "TurnPassed", to: "b" },
    ];
    expect(narrate(events)).toBe("White's knight hit a mine on e4 and was destroyed");
  });

  it("narrates a king losing a life", () => {
    const events: EventView[] = [
      { type: "MineTriggered", square: 28, by: { color: "b", type: "k" } },
      { type: "LifeLost", color: "b", square: 28, livesLeft: 2 },
    ];
    expect(narrate(events)).toBe(
      "Black's king hit a mine on e4. Black's king lost a life (2 left)",
    );
  });

  it("narrates captures, check exceptions and reshuffles", () => {
    const capture = { ...knightMove, captured: "p", captureSquare: 28 } as const;
    expect(narrate([{ type: "MoveMade", color: "w", move: capture }])).toBe(
      "White's knight captured a pawn on e4",
    );
    expect(narrate([{ type: "CheckExceptionTriggered", color: "w" }])).toContain("must move again");
    expect(narrate([{ type: "Reshuffled", mineCount: 8 }])).toBe("Mines reshuffled (8 mines)");
  });

  it("narrates the end of the game", () => {
    expect(narrate([{ type: "GameOver", result: "b", reason: "resignation" }])).toBe(
      "Black wins by resignation",
    );
    expect(narrate([{ type: "GameOver", result: "draw", reason: "agreement" }])).toBe(
      "Draw by agreement",
    );
  });
});
