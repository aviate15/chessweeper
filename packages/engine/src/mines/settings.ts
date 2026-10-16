import { DEFAULT_CONFIG, type GameConfig } from "./config";

/**
 * The two values a player picks per game (design doc 3.9): reshuffle interval and mine
 * density. Everything else in `GameConfig` stays at its default. Shared by the server (which
 * validates), the web client (which offers the choices) and the public view.
 */
export interface GameSettings {
  /** Turns without a capture before a reshuffle. */
  readonly reshuffleInterval: number;
  /** Mine density in whole percent of free squares. */
  readonly densityPercent: number;
}

export const INTERVAL_MIN = 2;
export const INTERVAL_MAX = 20;
export const DENSITY_MIN = 5;
export const DENSITY_MAX = 50;
export const DENSITY_STEP = 5;

export const DEFAULT_SETTINGS: GameSettings = {
  reshuffleInterval: DEFAULT_CONFIG.reshuffleInterval,
  densityPercent: Math.round(DEFAULT_CONFIG.mineDensity * 100),
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Clamps to the allowed ranges: interval 2-20, density 5-50 in steps of 5. A missing or
 * non-numeric value falls back to the default.
 */
export function clampSettings(raw: {
  readonly reshuffleInterval?: unknown;
  readonly densityPercent?: unknown;
}): GameSettings {
  const interval =
    typeof raw.reshuffleInterval === "number" && Number.isFinite(raw.reshuffleInterval)
      ? clamp(Math.round(raw.reshuffleInterval), INTERVAL_MIN, INTERVAL_MAX)
      : DEFAULT_SETTINGS.reshuffleInterval;
  const density =
    typeof raw.densityPercent === "number" && Number.isFinite(raw.densityPercent)
      ? clamp(
          Math.round(raw.densityPercent / DENSITY_STEP) * DENSITY_STEP,
          DENSITY_MIN,
          DENSITY_MAX,
        )
      : DEFAULT_SETTINGS.densityPercent;
  return { reshuffleInterval: interval, densityPercent: density };
}

/** Engine config for the settings (mine cap and king lives stay at their defaults). */
export function configFromSettings(settings: GameSettings): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    reshuffleInterval: settings.reshuffleInterval,
    mineDensity: settings.densityPercent / 100,
  };
}

/** The settings a config corresponds to, as shown to players (no clamping). */
export function settingsFromConfig(config: GameConfig): GameSettings {
  return {
    reshuffleInterval: config.reshuffleInterval,
    densityPercent: Math.round(config.mineDensity * 100),
  };
}
