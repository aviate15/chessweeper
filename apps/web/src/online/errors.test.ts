import { ERROR_CODES } from "@chessweeper/protocol";
import { describe, expect, it } from "vitest";
import { FATAL_MESSAGES, FRIENDLY_ERRORS, friendlyError } from "./errors";

describe("friendlyError", () => {
  it("has copy for every wire error code", () => {
    for (const code of ERROR_CODES) {
      expect(FRIENDLY_ERRORS[code].length).toBeGreaterThan(5);
      expect(friendlyError(code)).toBe(FRIENDLY_ERRORS[code]);
    }
  });
  it("falls back to a generic message for unknown codes", () => {
    expect(friendlyError("protocol")).toMatch(/something went wrong/i);
    expect(friendlyError("???")).toBe(friendlyError("protocol"));
  });
  it("describes every fatal reason", () => {
    for (const text of Object.values(FATAL_MESSAGES)) expect(text.length).toBeGreaterThan(5);
  });
});
