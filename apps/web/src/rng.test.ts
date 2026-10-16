import { describe, expect, it } from "vitest";
import { createCryptoRng } from "./rng";

describe("createCryptoRng", () => {
  it("stays within [0, max)", () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 500; i++) {
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(rng.nextInt(1)).toBe(0);
  });

  it("rejects words from the biased tail instead of folding them", () => {
    // max = 3: limit = 2^32 - 1, so only 0xffffffff is biased and must be redrawn.
    const queue = [0xffffffff, 0xffffffff, 4];
    const rng = createCryptoRng((out) => {
      out[0] = queue.shift() ?? 0;
    });
    expect(rng.nextInt(3)).toBe(1);
    expect(queue).toEqual([]);
  });

  it("is roughly uniform over a small range", () => {
    const rng = createCryptoRng();
    const draws = 20000;
    const tally = [0, 0, 0, 0, 0];
    for (let i = 0; i < draws; i++) {
      const n = rng.nextInt(5);
      tally[n] = (tally[n] ?? 0) + 1;
    }
    for (const c of tally) expect(Math.abs(c - draws / 5)).toBeLessThan(draws * 0.03);
  });

  it("rejects invalid bounds", () => {
    const rng = createCryptoRng();
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });
});
