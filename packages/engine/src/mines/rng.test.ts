import { describe, expect, it } from "vitest";
import { createSeededRng, pickDistinct } from "./rng";

describe("seeded RNG", () => {
  it("repeats for the same seed and differs across seeds", () => {
    const draw = (seed: number) =>
      Array.from({ length: 10 }, () => 0).map(
        (
          (rng) => () =>
            rng.nextInt(1000)
        )(createSeededRng(seed)),
      );
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });

  it("stays within range", () => {
    const rng = createSeededRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it("picks distinct items", () => {
    const picked = pickDistinct(createSeededRng(3), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 8);
    expect(new Set(picked).size).toBe(8);
    expect(() => pickDistinct(createSeededRng(3), [1, 2], 3)).toThrow(RangeError);
  });
});
