import {
  DEFAULT_CONFIG,
  DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
  type GameConfig,
  type GameMode,
} from "./config";

/**
 * The values a player picks per game (design doc 3.9, 3.10): reshuffle interval, mine
 * density and mode. Everything else in `GameConfig` stays at its default. Shared by the
 * server (which validates), the web client (which offers the choices) and the public view.
 */
export interface GameSettings {
  /** Turns without a capture before a reshuffle. */
  readonly reshuffleInterval: number;
  /** Mine density in whole percent of free squares. */
  readonly densityPercent: number;
  /**
   * Game mode (3.10). Omitted for Auto mine so Auto settings keep their exact shape (and
   * existing wire data and tests stay valid); read it with `modeOf`.
   */
  readonly mode?: GameMode;
}

/** The mode of a settings object; a missing `mode` means Auto (3.10). */
export const modeOf = (settings: { readonly mode?: GameMode }): GameMode => settings.mode ?? "auto";

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
 * non-numeric value falls back to the default (the interval default depends on the mode,
 * 3.10). Only the exact string "manual" selects Manual mine; anything else is Auto.
 */
export function clampSettings(raw: {
  readonly reshuffleInterval?: unknown;
  readonly densityPercent?: unknown;
  readonly mode?: unknown;
}): GameSettings {
  const mode: GameMode = raw.mode === "manual" ? "manual" : "auto";
  const interval =
    typeof raw.reshuffleInterval === "number" && Number.isFinite(raw.reshuffleInterval)
      ? clamp(Math.round(raw.reshuffleInterval), INTERVAL_MIN, INTERVAL_MAX)
      : mode === "manual"
        ? DEFAULT_MANUAL_RESHUFFLE_INTERVAL
        : DEFAULT_SETTINGS.reshuffleInterval;
  const density =
    typeof raw.densityPercent === "number" && Number.isFinite(raw.densityPercent)
      ? clamp(
          Math.round(raw.densityPercent / DENSITY_STEP) * DENSITY_STEP,
          DENSITY_MIN,
          DENSITY_MAX,
        )
      : DEFAULT_SETTINGS.densityPercent;
  return mode === "manual"
    ? { reshuffleInterval: interval, densityPercent: density, mode }
    : { reshuffleInterval: interval, densityPercent: density };
}

/** Engine config for the settings (mine cap and king lives stay at their defaults). */
export function configFromSettings(settings: GameSettings): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    reshuffleInterval: settings.reshuffleInterval,
    mineDensity: settings.densityPercent / 100,
    mode: modeOf(settings),
  };
}

/** The settings a config corresponds to, as shown to players (no clamping). */
export function settingsFromConfig(config: GameConfig): GameSettings {
  const base = {
    reshuffleInterval: config.reshuffleInterval,
    densityPercent: Math.round(config.mineDensity * 100),
  };
  return config.mode === "manual" ? { ...base, mode: "manual" } : base;
}
