import { describe, expect, it } from "vitest";
import { isInCheck, isSquareAttacked } from "./attacks";
import { parseFen } from "./fen";
import { parseSquare } from "./square";
import type { Square } from "./types";

function sq(name: string): Square {
  const square = parseSquare(name);
  if (square === null) throw new Error(`bad square ${name}`);
  return square;
}

function attacked(fen: string, square: string, by: "w" | "b"): boolean {
  return isSquareAttacked(parseFen(fen).board, sq(square), by);
}

describe("isSquareAttacked", () => {
  it("detects knight attacks", () => {
    const fen = "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "e6", "w")).toBe(true);
    expect(attacked(fen, "b3", "w")).toBe(true);
    expect(attacked(fen, "d5", "w")).toBe(false);
  });

  it("detects pawn attacks in the right direction for each color", () => {
    const fen = "4k3/8/8/3p4/3P4/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "c5", "w")).toBe(true); // white pawn d4 attacks c5, e5
    expect(attacked(fen, "c3", "w")).toBe(false);
    expect(attacked(fen, "e4", "b")).toBe(true); // black pawn d5 attacks c4, e4
    expect(attacked(fen, "e6", "b")).toBe(false);
  });

  it("stops sliders at the first blocker", () => {
    const fen = "4k3/8/8/8/R2p3q/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "c4", "w")).toBe(true);
    expect(attacked(fen, "d4", "w")).toBe(true); // the blocker itself is attacked
    expect(attacked(fen, "e4", "w")).toBe(false); // behind the blocker
    expect(attacked(fen, "e7", "b")).toBe(true); // queen diagonal h4-e7
  });

  it("detects king adjacency", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    expect(attacked(fen, "d2", "w")).toBe(true);
    expect(attacked(fen, "e3", "w")).toBe(false);
  });
});

describe("isInCheck", () => {
  it("reports check on the side to move", () => {
    expect(isInCheck(parseFen("4k3/8/8/8/8/8/8/R3K3 b - - 0 1"))).toBe(false);
    expect(isInCheck(parseFen("4k3/8/8/8/8/8/8/4KR2 b - - 0 1"))).toBe(false);
    expect(isInCheck(parseFen("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1"))).toBe(true);
  });
});
