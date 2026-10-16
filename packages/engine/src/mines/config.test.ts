import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_RESHUFFLE_INTERVAL, mineCountFor } from "./config";

describe("mineCountFor", () => {
  // 3.1: 30% of the 32 squares on ranks 3-6 is 10 mines (9.6 rounds half-up).
  it("gives 10 mines for 32 free squares", () => {
    expect(mineCountFor(32, DEFAULT_CONFIG)).toBe(10);
  });

  // 3.7: round half-up.
  it("rounds half up", () => {
    expect(mineCountFor(25, DEFAULT_CONFIG)).toBe(8); // 7.5
    expect(mineCountFor(24, DEFAULT_CONFIG)).toBe(7); // 7.2
  });

  // 3.7: optional cap; density is configurable.
  it("applies the cap and a custom density", () => {
    expect(mineCountFor(60, { ...DEFAULT_CONFIG, mineCap: 10 })).toBe(10);
    expect(mineCountFor(32, { ...DEFAULT_CONFIG, mineDensity: 0.5 })).toBe(16);
  });
});

// 3.7: the reshuffle interval default is 6 total turns (3 per player), the mine density 30%.
describe("DEFAULT_CONFIG", () => {
  it("reshuffles every 6 turns, density 30%", () => {
    expect(DEFAULT_RESHUFFLE_INTERVAL).toBe(6);
    expect(DEFAULT_CONFIG.reshuffleInterval).toBe(6);
    expect(DEFAULT_CONFIG.mineDensity).toBe(0.3);
  });
});
