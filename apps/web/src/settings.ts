import {
  DEFAULT_SETTINGS,
  clampSettings,
  configFromSettings,
  type GameSettings,
} from "@chessweeper/engine";

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

/** The two rules values chosen per game (3.7): the engine's `GameSettings`. */
export type GameOptions = GameSettings;

export {
  DENSITY_MAX,
  DENSITY_MIN,
  DENSITY_STEP,
  INTERVAL_MAX,
  INTERVAL_MIN,
} from "@chessweeper/engine";

export const DEFAULT_OPTIONS: GameOptions = DEFAULT_SETTINGS;

/** Clamp to the allowed ranges; non-numbers fall back to the default. */
export const clampOptions = clampSettings;

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

/** Engine config for the options (mine cap and king lives stay at their defaults). */
export const configFromOptions = configFromSettings;

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
