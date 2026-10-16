import { CODE_ALPHABET } from "@chessweeper/protocol";
import { describe, expect, it } from "vitest";
import { isValidCode, normalizeCode } from "./code";

describe("normalizeCode", () => {
  it("uppercases and strips spaces, tabs and newlines", () => {
    expect(normalizeCode(" ab c\tdef\n")).toBe("ABCDEF");
    expect(normalizeCode("xyz 234")).toBe("XYZ234");
  });
});

describe("isValidCode", () => {
  it("accepts six characters from the alphabet", () => {
    expect(isValidCode("ABCDEF")).toBe(true);
    expect(isValidCode(CODE_ALPHABET.slice(0, 6))).toBe(true);
  });
  it("rejects wrong length, look-alikes and lowercase", () => {
    expect(isValidCode("ABCDE")).toBe(false);
    expect(isValidCode("ABCDEFG")).toBe(false);
    expect(isValidCode("ABCDE0")).toBe(false);
    expect(isValidCode("ABCDEI")).toBe(false);
    expect(isValidCode("abcdef")).toBe(false);
  });
});
