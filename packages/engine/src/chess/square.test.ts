import { describe, expect, it } from "vitest";
import { fileOf, offsetSquare, parseSquare, rankOf, squareName, squareOf } from "./square";

describe("squares", () => {
  it("numbers squares a1 = 0 through h8 = 63", () => {
    expect(squareOf(0, 0)).toBe(0);
    expect(squareOf(7, 0)).toBe(7);
    expect(squareOf(0, 7)).toBe(56);
    expect(squareOf(7, 7)).toBe(63);
    expect(fileOf(parseSquare("e4") ?? -1)).toBe(4);
    expect(rankOf(parseSquare("e4") ?? -1)).toBe(3);
  });

  it("round-trips every square name", () => {
    for (let sq = 0; sq < 64; sq++) {
      expect(parseSquare(squareName(sq))).toBe(sq);
    }
    expect(squareName(0)).toBe("a1");
    expect(squareName(63)).toBe("h8");
  });

  it("rejects text that is not a square", () => {
    for (const bad of ["", "e", "e9", "i1", "e0", "e44", "E4"]) {
      expect(parseSquare(bad)).toBeNull();
    }
  });

  it("returns null for offsets that leave the board", () => {
    const h1 = squareOf(7, 0);
    expect(offsetSquare(h1, 1, 0)).toBeNull();
    expect(offsetSquare(h1, 0, -1)).toBeNull();
    expect(offsetSquare(h1, -1, 2)).toBe(parseSquare("g3"));
  });
});
