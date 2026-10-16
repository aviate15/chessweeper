// Opt-in deep perft (too slow for CI). Run: pnpm --filter @chessweeper/engine perft:deep
// Reference numbers: https://www.chessprogramming.org/Perft_Results (see perft-positions.ts).
import { describe, expect, it } from "vitest";
import { parseFen } from "./fen";
import { perft } from "./perft";
import { PERFT_POSITIONS } from "./perft-positions";

/** Depths beyond CI, chosen to finish in minutes, not hours. */
const DEEP_DEPTHS: Readonly<Record<string, readonly number[]>> = {
  "Initial position": [4, 5],
  "Position 2 (Kiwipete)": [4],
  "Position 3": [5, 6],
  "Position 4": [4],
  "Position 4 (mirrored)": [4],
  "Position 5": [4],
  "Position 6": [4],
};

describe("perft (deep)", () => {
  for (const { name, fen, nodes } of PERFT_POSITIONS) {
    for (const depth of DEEP_DEPTHS[name] ?? []) {
      it(`${name}, depth ${String(depth)} = ${String(nodes[depth - 1])}`, () => {
        expect(perft(parseFen(fen), depth)).toBe(nodes[depth - 1]);
      });
    }
  }
});
