// 3.10 Manual mine mode: the mode setting and its defaults.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
  DEFAULT_RESHUFFLE_INTERVAL,
} from "./config";
import {
  DEFAULT_SETTINGS,
  clampSettings,
  configFromSettings,
  modeOf,
  settingsFromConfig,
} from "./settings";

describe("3.10 mode setting", () => {
  it("the manual interval default is 10 and the auto default stays 6", () => {
    expect(DEFAULT_MANUAL_RESHUFFLE_INTERVAL).toBe(10);
    expect(DEFAULT_RESHUFFLE_INTERVAL).toBe(6);
  });

  it("'manual' selects manual mode with the manual interval default and 30% density", () => {
    expect(clampSettings({ mode: "manual" })).toEqual({
      reshuffleInterval: 10,
      densityPercent: 30,
      mode: "manual",
    });
  });

  it("a missing or unknown mode means auto, with the auto default interval", () => {
    expect(clampSettings({})).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
    for (const mode of ["Manual", "auto", "", 1, null, {}]) {
      const settings = clampSettings({ mode });
      expect(modeOf(settings)).toBe("auto");
      expect(settings).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
    }
    expect(modeOf(DEFAULT_SETTINGS)).toBe("auto");
  });

  it("an explicit interval wins and is clamped in both modes", () => {
    expect(clampSettings({ mode: "manual", reshuffleInterval: 99 }).reshuffleInterval).toBe(20);
    expect(clampSettings({ mode: "manual", reshuffleInterval: 1 }).reshuffleInterval).toBe(2);
    expect(clampSettings({ mode: "manual", reshuffleInterval: 7 }).reshuffleInterval).toBe(7);
  });

  it("the config carries the mode and round-trips to the settings", () => {
    expect(DEFAULT_CONFIG.mode).toBe("auto");
    const manual = clampSettings({ mode: "manual", reshuffleInterval: 8, densityPercent: 40 });
    const config = configFromSettings(manual);
    expect(config.mode).toBe("manual");
    expect(config.reshuffleInterval).toBe(8);
    expect(config.mineDensity).toBe(0.4);
    expect(settingsFromConfig(config)).toEqual(manual);
    expect(settingsFromConfig(configFromSettings(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });
});
