// Move-generation correctness against the Chess Programming Wiki perft suite.
// Reference numbers: https://www.chessprogramming.org/Perft_Results (see perft-positions.ts).
// CI runs shallow depths only; deeper ones live in perft.deep.test.ts (opt-in).
import { describe, expect, it } from "vitest";
import { parseFen } from "./fen";
import { perft, perftDivide } from "./perft";
import { PERFT_POSITIONS } from "./perft-positions";

/** Max depth per position in CI, kept to a few seconds in total. */
const CI_DEPTH: Readonly<Record<string, number>> = {
  "Initial position": 3,
  "Position 2 (Kiwipete)": 3,
  "Position 3": 4,
  "Position 4": 3,
  "Position 4 (mirrored)": 3,
  "Position 5": 3,
  "Position 6": 3,
};

describe("perft (CI depths)", () => {
  for (const { name, fen, nodes } of PERFT_POSITIONS) {
    const maxDepth = CI_DEPTH[name] ?? 1;
    for (let depth = 1; depth <= maxDepth; depth++) {
      it(`${name}, depth ${String(depth)} = ${String(nodes[depth - 1])}`, () => {
        expect(perft(parseFen(fen), depth)).toBe(nodes[depth - 1]);
      });
    }
  }
});

describe("perftDivide", () => {
  it("splits the total by first move", () => {
    const divide = perftDivide(
      parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
      2,
    );
    expect(divide.size).toBe(20);
    expect(divide.get("e2e4")).toBe(20);
    expect([...divide.values()].reduce((a, b) => a + b, 0)).toBe(400);
  });
});
