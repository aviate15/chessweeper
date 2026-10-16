import { describe, expect, it } from "vitest";
import { parseSquare } from "../chess/square";
import { adjacentMineCount, revealedNumbers } from "./numbers";
import { gameFromScenario } from "./scenario";

function sq(name: string): number {
  const square = parseSquare(name);
  if (square === null) throw new Error(name);
  return square;
}

const FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

describe("numbers", () => {
  // 3.2: a number counts the mines in the 8 adjacent squares.
  it("counts the 8 neighbours only", () => {
    const mines = new Set([sq("d4"), sq("e4"), sq("f4"), sq("e6"), sq("c3")]);
    expect(adjacentMineCount(mines, sq("e5"))).toBe(4);
    expect(adjacentMineCount(mines, sq("e4"))).toBe(2); // not counting itself
  });

  it("handles edges and corners", () => {
    const mines = new Set([sq("a2"), sq("b1"), sq("b2")]);
    expect(adjacentMineCount(mines, sq("a1"))).toBe(3);
    expect(adjacentMineCount(mines, sq("h8"))).toBe(0);
  });

  // 3.2: numbers are live and only shown for revealed squares.
  it("reports numbers only for revealed squares, from the live mines", () => {
    const game = gameFromScenario({ fen: FEN, mines: ["d4"], revealed: ["e5", "h8"] });
    expect([...revealedNumbers(game)]).toEqual([
      [sq("e5"), 1],
      [sq("h8"), 0],
    ]);
  });
});
