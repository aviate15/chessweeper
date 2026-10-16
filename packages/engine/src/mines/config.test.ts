import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, mineCountFor } from "./config";

describe("mineCountFor", () => {
  // 3.1: 25% of the 32 squares on ranks 3-6 is 8 mines.
  it("gives 8 mines for 32 free squares", () => {
    expect(mineCountFor(32, DEFAULT_CONFIG)).toBe(8);
  });

  // 3.7: round half-up.
  it("rounds half up", () => {
    expect(mineCountFor(30, DEFAULT_CONFIG)).toBe(8); // 7.5
    expect(mineCountFor(29, DEFAULT_CONFIG)).toBe(7); // 7.25
  });

  // 3.7: optional cap; density is configurable.
  it("applies the cap and a custom density", () => {
    expect(mineCountFor(60, { ...DEFAULT_CONFIG, mineCap: 10 })).toBe(10);
    expect(mineCountFor(32, { ...DEFAULT_CONFIG, mineDensity: 0.5 })).toBe(16);
  });
});
