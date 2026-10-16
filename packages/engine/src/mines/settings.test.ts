// 3.7 per-game settings: bounds, clamping and the config they produce.
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import {
  clampSettings,
  configFromSettings,
  DEFAULT_SETTINGS,
  settingsFromConfig,
} from "./settings";

describe("settings", () => {
  it("defaults to 6 turns and 30%", () => {
    expect(DEFAULT_SETTINGS).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
  });

  it("clamps the interval to 2-20 and the density to 5-50 in steps of 5", () => {
    expect(clampSettings({ reshuffleInterval: 1, densityPercent: 1 })).toEqual({
      reshuffleInterval: 2,
      densityPercent: 5,
    });
    expect(clampSettings({ reshuffleInterval: 99, densityPercent: 99 })).toEqual({
      reshuffleInterval: 20,
      densityPercent: 50,
    });
    expect(clampSettings({ reshuffleInterval: 7.4, densityPercent: 33 })).toEqual({
      reshuffleInterval: 7,
      densityPercent: 35,
    });
  });

  it("falls back to the defaults for missing or non-numeric values", () => {
    expect(clampSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(clampSettings({ reshuffleInterval: "x", densityPercent: Number.NaN })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("round-trips through the engine config", () => {
    const settings = { reshuffleInterval: 3, densityPercent: 40 };
    const config = configFromSettings(settings);
    expect(config).toEqual({ ...DEFAULT_CONFIG, reshuffleInterval: 3, mineDensity: 0.4 });
    expect(settingsFromConfig(config)).toEqual(settings);
  });
});
