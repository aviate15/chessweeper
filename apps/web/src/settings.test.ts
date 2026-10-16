import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPTIONS,
  clampOptions,
  configFromOptions,
  loadFlip,
  loadOptions,
  saveFlip,
  saveOptions,
} from "./settings";

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

describe("game options", () => {
  it("defaults to the engine defaults", () => {
    expect(loadOptions()).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
    expect(configFromOptions(DEFAULT_OPTIONS).mineDensity).toBe(0.3);
  });

  it("round-trips through storage", () => {
    saveOptions({ reshuffleInterval: 5, densityPercent: 40 });
    expect(loadOptions()).toEqual({ reshuffleInterval: 5, densityPercent: 40 });
    expect(configFromOptions(loadOptions())).toMatchObject({
      reshuffleInterval: 5,
      mineDensity: 0.4,
    });
  });

  it("clamps out-of-range values and snaps density to steps of 5", () => {
    expect(clampOptions({ reshuffleInterval: 1, densityPercent: 3 })).toEqual({
      reshuffleInterval: 2,
      densityPercent: 5,
    });
    expect(clampOptions({ reshuffleInterval: 99, densityPercent: 99 })).toEqual({
      reshuffleInterval: 20,
      densityPercent: 50,
    });
    expect(clampOptions({ reshuffleInterval: 7.4, densityPercent: 22 })).toEqual({
      reshuffleInterval: 7,
      densityPercent: 20,
    });
  });

  it("falls back to defaults for garbage or throwing storage", () => {
    localStorage.setItem("chessweeper.options", "not json");
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
    localStorage.setItem("chessweeper.options", JSON.stringify({ reshuffleInterval: "x" }));
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
    localStorage.setItem("chessweeper.options", JSON.stringify({ reshuffleInterval: 500 }));
    expect(loadOptions().reshuffleInterval).toBe(20);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
    expect(() => {
      saveOptions(DEFAULT_OPTIONS);
    }).not.toThrow();
  });
});
