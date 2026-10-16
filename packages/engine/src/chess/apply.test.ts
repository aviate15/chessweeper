import { describe, expect, it } from "vitest";
import { applyMove } from "./apply";
import { parseFen, START_FEN, toFen } from "./fen";
import type { Move } from "./move";
import { parseSquare } from "./square";
import type { Square } from "./types";

function sq(name: string): Square {
  const square = parseSquare(name);
  if (square === null) throw new Error(`bad square ${name}`);
  return square;
}

/** Hand-built moves; legal-move generation is tested separately in movegen.test.ts. */
function move(from: string, to: string, fields: Partial<Move> = {}): Move {
  return {
    from: sq(from),
    to: sq(to),
    piece: "p",
    captured: null,
    captureSquare: null,
    promotion: null,
    castle: null,
    enPassant: false,
    doublePush: false,
    ...fields,
  };
}

function play(fen: string, m: Move): string {
  return toFen(applyMove(parseFen(fen), m));
}

describe("applyMove", () => {
  it("never mutates the input position", () => {
    const pos = parseFen(START_FEN);
    applyMove(pos, move("e2", "e4", { doublePush: true }));
    expect(toFen(pos)).toBe(START_FEN);
  });

  it("sets the en passant target on a double push and clears it afterwards", () => {
    const afterE4 = applyMove(parseFen(START_FEN), move("e2", "e4", { doublePush: true }));
    expect(toFen(afterE4)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    const afterNf6 = applyMove(afterE4, move("g8", "f6", { piece: "n" }));
    expect(toFen(afterNf6)).toBe("rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2");
  });

  // 3.5: en passant follows standard chess rules.
  it("removes the captured pawn on en passant", () => {
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
    const ep = move("e5", "d6", {
      captured: "p",
      captureSquare: sq("d5"),
      enPassant: true,
    });
    expect(play(fen, ep)).toBe("4k3/8/3P4/8/8/8/8/4K3 b - - 0 2");
  });

  // 3.5: castling follows standard chess rules.
  it("moves the rook when castling and drops both rights", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 3 10";
    expect(play(fen, move("e1", "g1", { piece: "k", castle: "king" }))).toBe(
      "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 4 10",
    );
    expect(play(fen, move("e1", "c1", { piece: "k", castle: "queen" }))).toBe(
      "r3k2r/8/8/8/8/8/8/2KR3R b kq - 4 10",
    );
  });

  it("drops one castling right when a rook leaves its corner", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(play(fen, move("h1", "h5", { piece: "r" }))).toBe("r3k2r/8/8/7R/8/8/8/R3K3 b Qkq - 1 1");
  });

  it("drops the opponent's castling right when its rook is captured in the corner", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(
      play(fen, move("a1", "a8", { piece: "r", captured: "r", captureSquare: sq("a8") })),
    ).toBe("R3k2r/8/8/8/8/8/8/4K2R b Kk - 0 1");
  });

  // 3.5: promotion follows standard chess rules.
  it("promotes, with or without a capture", () => {
    const fen = "1n2k3/P7/8/8/8/8/8/4K3 w - - 5 40";
    expect(play(fen, move("a7", "a8", { promotion: "q" }))).toBe(
      "Qn2k3/8/8/8/8/8/8/4K3 b - - 0 40",
    );
    expect(
      play(fen, move("a7", "b8", { promotion: "n", captured: "n", captureSquare: sq("b8") })),
    ).toBe("1N2k3/8/8/8/8/8/8/4K3 b - - 0 40");
  });

  it("increments the fullmove number after Black moves", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 b - - 7 12";
    expect(play(fen, move("e8", "d8", { piece: "k" }))).toBe("3k4/8/8/8/8/8/8/4K3 w - - 8 13");
  });
});
