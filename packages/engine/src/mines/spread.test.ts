// 3.1 / 3.7: at most 2 mines in any 3x3 area.
import { describe, expect, it } from "vitest";
import { createSeededRng } from "./rng";
import { MAX_MINES_PER_3X3, placeSpread } from "./spread";
import { maxMinesIn3x3 } from "./test-utils";

const ALL = Array.from({ length: 64 }, (_, s) => s);

describe("placeSpread", () => {
  it("never exceeds the limit and returns distinct candidate squares", () => {
    for (let seed = 0; seed < 100; seed++) {
      const placed = placeSpread(createSeededRng(seed), ALL, 14);
      expect(new Set(placed).size).toBe(placed.length);
      expect(maxMinesIn3x3(new Set(placed))).toBeLessThanOrEqual(MAX_MINES_PER_3X3);
    }
  });

  it("places the full count when there is room", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(placeSpread(createSeededRng(seed), ALL, 10)).toHaveLength(10);
    }
  });

  it("places fewer when the limit leaves no room, and never more than asked", () => {
    const placed = placeSpread(createSeededRng(1), ALL, 60);
    expect(placed.length).toBeLessThan(30);
    expect(placeSpread(createSeededRng(1), ALL, 3)).toHaveLength(3);
  });

  it("uses only the candidate squares", () => {
    const candidates = [0, 1, 2, 3, 4, 5, 6, 7];
    const placed = placeSpread(createSeededRng(2), candidates, 8);
    for (const s of placed) expect(candidates).toContain(s);
  });

  it("is deterministic for a seed", () => {
    expect(placeSpread(createSeededRng(9), ALL, 12)).toEqual(
      placeSpread(createSeededRng(9), ALL, 12),
    );
  });
});
