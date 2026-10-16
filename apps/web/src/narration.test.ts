import type { EventView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import type { MoveView, PublicView } from "@chessweeper/engine";
import { narrate, numberDescription, revealSource } from "./narration";

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

const move = (over: Partial<MoveView>): MoveView => ({ ...knightMove, ...over });

const viewOf = (log: PublicView["log"]) => ({ log }) as unknown as PublicView;

describe("revealSource", () => {
  it("names the piece that landed (colour and type)", () => {
    const view = viewOf([
      {
        color: "w",
        events: [
          { type: "MoveMade", color: "w", move: knightMove },
          { type: "NumberRevealed", square: 28, number: 2 },
        ],
      },
    ]);
    expect(revealSource(view, 28)).toEqual({ color: "w", piece: "n" });
    expect(revealSource(view, 29)).toBeNull();
  });

  it("names the rook for a castling rook square and the king for the king square", () => {
    const castle = move({ from: 4, to: 6, piece: "k", castle: "king" });
    const view = viewOf([
      {
        color: "w",
        events: [
          { type: "MoveMade", color: "w", move: castle },
          { type: "NumberRevealed", square: 6, number: 1 },
          { type: "NumberRevealed", square: 5, number: 0 },
        ],
      },
    ]);
    expect(revealSource(view, 6)).toEqual({ color: "w", piece: "k" });
    expect(revealSource(view, 5)).toEqual({ color: "w", piece: "r" });
    const black = viewOf([
      {
        color: "b",
        events: [
          {
            type: "MoveMade",
            color: "b",
            move: move({ from: 60, to: 58, piece: "k", castle: "queen" }),
          },
          { type: "NumberRevealed", square: 59, number: 3 },
        ],
      },
    ]);
    expect(revealSource(black, 59)).toEqual({ color: "b", piece: "r" });
  });

  it("names the promoted piece", () => {
    const view = viewOf([
      {
        color: "w",
        events: [
          {
            type: "MoveMade",
            color: "w",
            move: move({ from: 52, to: 60, piece: "p", promotion: "q" }),
          },
          { type: "NumberRevealed", square: 60, number: 1 },
        ],
      },
    ]);
    expect(revealSource(view, 60)).toEqual({ color: "w", piece: "q" });
  });

  it("finds the landing on a crater after the mine blew up", () => {
    const view = viewOf([
      {
        color: "w",
        events: [
          { type: "MoveMade", color: "w", move: knightMove },
          { type: "MineTriggered", square: 28, by: { color: "w", type: "n" } },
          { type: "PieceDestroyed", square: 28, piece: { color: "w", type: "n" } },
        ],
      },
      {
        color: "b",
        events: [
          { type: "MoveMade", color: "b", move: move({ from: 62, to: 28 }) },
          { type: "NumberRevealed", square: 28, number: 1 },
        ],
      },
    ]);
    expect(revealSource(view, 28)).toEqual({ color: "b", piece: "n" });
  });

  it("returns null for a reveal that predates a reshuffle", () => {
    const view = viewOf([
      {
        color: "w",
        events: [
          { type: "MoveMade", color: "w", move: knightMove },
          { type: "NumberRevealed", square: 28, number: 2 },
        ],
      },
      { color: "b", events: [{ type: "Reshuffled", mineCount: 8 }] },
    ]);
    expect(revealSource(view, 28)).toBeNull();
  });

  it("returns the latest reveal when a square was revealed twice", () => {
    const view = viewOf([
      {
        color: "w",
        events: [
          { type: "MoveMade", color: "w", move: knightMove },
          { type: "NumberRevealed", square: 28, number: 2 },
        ],
      },
      {
        color: "b",
        events: [
          {
            type: "MoveMade",
            color: "b",
            move: move({ from: 62, to: 28, captured: "n", captureSquare: 28 }),
          },
          { type: "NumberRevealed", square: 28, number: 2 },
        ],
      },
    ]);
    expect(revealSource(view, 28)).toEqual({ color: "b", piece: "n" });
  });
});

describe("numberDescription", () => {
  const knight = { color: "w", piece: "n" } as const;
  it("words the count and the reveal", () => {
    expect(numberDescription(2, false, knight)).toBe(
      "2 mines among the 8 neighbouring squares. Revealed when White's knight landed here.",
    );
    expect(numberDescription(1, false, null)).toBe("1 mine among the 8 neighbouring squares.");
    expect(numberDescription(0, false, null)).toBe("No mines among the 8 neighbouring squares.");
  });
  it("mentions a crater and is null for a hidden square", () => {
    expect(numberDescription(null, true, null)).toBe("A mine blew up here and left a crater.");
    expect(numberDescription(3, true, null)).toContain("crater");
    expect(numberDescription(null, false, null)).toBeNull();
  });
});
