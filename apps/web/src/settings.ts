import { DEFAULT_CONFIG, DEFAULT_RESHUFFLE_INTERVAL, type GameConfig } from "@chessweeper/engine";

const FLIP_KEY = "chessweeper.flip";

/** Flip-board preference for pass-and-play. Default ON; storage may be missing or throw. */
export function loadFlip(): boolean {
  try {
    return localStorage.getItem(FLIP_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveFlip(flip: boolean): void {
  try {
    localStorage.setItem(FLIP_KEY, flip ? "1" : "0");
  } catch {
    // Storage unavailable: the setting simply does not persist.
  }
}

const OPTIONS_KEY = "chessweeper.options";

/** The two tunable rules values exposed in Game > Options (3.7 config). */
export interface GameOptions {
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

export const DEFAULT_OPTIONS: GameOptions = {
  reshuffleInterval: DEFAULT_RESHUFFLE_INTERVAL,
  densityPercent: Math.round(DEFAULT_CONFIG.mineDensity * 100),
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Clamp to the allowed ranges; non-numbers fall back to the default. */
export function clampOptions(raw: {
  reshuffleInterval?: unknown;
  densityPercent?: unknown;
}): GameOptions {
  const interval =
    typeof raw.reshuffleInterval === "number" && Number.isFinite(raw.reshuffleInterval)
      ? clamp(Math.round(raw.reshuffleInterval), INTERVAL_MIN, INTERVAL_MAX)
      : DEFAULT_OPTIONS.reshuffleInterval;
  const density =
    typeof raw.densityPercent === "number" && Number.isFinite(raw.densityPercent)
      ? clamp(
          Math.round(raw.densityPercent / DENSITY_STEP) * DENSITY_STEP,
          DENSITY_MIN,
          DENSITY_MAX,
        )
      : DEFAULT_OPTIONS.densityPercent;
  return { reshuffleInterval: interval, densityPercent: density };
}

export function loadOptions(): GameOptions {
  try {
    const text = localStorage.getItem(OPTIONS_KEY);
    if (text === null) return DEFAULT_OPTIONS;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_OPTIONS;
    return clampOptions(parsed);
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(options: GameOptions): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(clampOptions(options)));
  } catch {
    // Storage unavailable: the setting simply does not persist.
  }
}

/** Engine config for the saved options (mine cap and king lives stay at their defaults). */
export function configFromOptions(options: GameOptions): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    reshuffleInterval: options.reshuffleInterval,
    mineDensity: options.densityPercent / 100,
  };
}

const RULES_HIDDEN_KEY = "chessweeper.rulesHidden";

/** True when the player ticked "Don't show again" on the rules page. */
export function loadRulesHidden(): boolean {
  try {
    return localStorage.getItem(RULES_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveRulesHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(RULES_HIDDEN_KEY, "1");
    else localStorage.removeItem(RULES_HIDDEN_KEY);
  } catch {
    // Storage unavailable: the rules page simply shows again next time.
  }
}
