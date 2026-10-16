import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFlip, saveFlip } from "./settings";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("flip setting", () => {
  it("defaults to on and persists both values", () => {
    expect(loadFlip()).toBe(true);
    saveFlip(false);
    expect(loadFlip()).toBe(false);
    saveFlip(true);
    expect(loadFlip()).toBe(true);
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadFlip()).toBe(true);
    expect(() => {
      saveFlip(false);
    }).not.toThrow();
  });
});
