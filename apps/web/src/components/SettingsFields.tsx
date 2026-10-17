import { mineCountFor, type GameSettings } from "@chessweeper/engine";
import { useId } from "react";
import {
  DENSITY_MAX,
  DENSITY_MIN,
  DENSITY_STEP,
  INTERVAL_MAX,
  INTERVAL_MIN,
  clampOptions,
  configFromOptions,
} from "../settings";
import { DEFAULT_INTERVAL_BY_MODE, placementQuota, type GameMode } from "./placementTypes";

const range = (lo: number, hi: number, step: number) =>
  Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

/** One-line summary of a game's settings, shown to both players (3.7). */
export function settingsSummary(settings: GameSettings): string {
  const text = `Reshuffle every ${String(settings.reshuffleInterval)} turns, mine density ${String(settings.densityPercent)}%`;
  return settings.mode === "manual" ? `Manual mine mode. ${text}` : text;
}

/** The two per-game choices: reshuffle interval and mine density (3.7). */
export function SettingsFields({
  settings,
  onChange,
  modePicker,
}: {
  /** `mode` is optional: a missing mode means Auto mine. */
  settings: GameSettings & { mode?: GameMode };
  onChange: (settings: GameSettings & { mode?: GameMode }) => void;
  /**
   * Show the Mine mode picker. Without it the picker shows only when `settings` carries a mode.
   * Dialogs pass true so Auto settings (which omit `mode`) still offer the choice; the value
   * then carries an explicit mode, and `clampOptions` drops it again for Auto.
   */
  modePicker?: boolean;
}) {
  const id = useId();
  const startMines = mineCountFor(32, configFromOptions(settings));
  const mode = settings.mode ?? (modePicker === true ? "auto" : undefined);
  // clampOptions may not know about `mode` yet, so carry it through explicitly.
  const clamp = (next: GameSettings & { mode?: GameMode }) => {
    const clamped: GameSettings & { mode?: GameMode } = clampOptions(next);
    return mode === undefined ? clamped : { ...clamped, mode };
  };
  const switchMode = (next: GameMode) => {
    // Move the interval to the new mode's default only if the player had not changed it.
    const untouched = settings.reshuffleInterval === DEFAULT_INTERVAL_BY_MODE[mode ?? "auto"];
    const reshuffleInterval = untouched
      ? DEFAULT_INTERVAL_BY_MODE[next]
      : settings.reshuffleInterval;
    onChange({ ...clampOptions({ ...settings, reshuffleInterval }), mode: next });
  };
  return (
    <>
      {mode !== undefined && (
        <div className="options-field">
          <label htmlFor={`${id}-mode`}>Mine mode</label>
          <select
            id={`${id}-mode`}
            className="retro-select"
            value={mode}
            onChange={(e) => {
              switchMode(e.target.value === "manual" ? "manual" : "auto");
            }}
          >
            <option value="auto">Auto mine</option>
            <option value="manual">Manual mine</option>
          </select>
        </div>
      )}
      <div className="options-field">
        <label htmlFor={`${id}-interval`}>Reshuffle every</label>
        <select
          id={`${id}-interval`}
          className="retro-select"
          value={settings.reshuffleInterval}
          onChange={(e) => {
            onChange(clamp({ ...settings, reshuffleInterval: Number(e.target.value) }));
          }}
        >
          {range(INTERVAL_MIN, INTERVAL_MAX, 1).map((n) => (
            <option key={n} value={n}>
              {n} turns
            </option>
          ))}
        </select>
      </div>
      <div className="options-field">
        <label htmlFor={`${id}-density`}>Mine density</label>
        <select
          id={`${id}-density`}
          className="retro-select"
          value={settings.densityPercent}
          onChange={(e) => {
            onChange(clamp({ ...settings, densityPercent: Number(e.target.value) }));
          }}
        >
          {range(DENSITY_MIN, DENSITY_MAX, DENSITY_STEP).map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </div>
      {mode === "manual" ? (
        <p data-testid="settings-mines">
          Each player places {placementQuota(settings.densityPercent)} mines
        </p>
      ) : (
        <p data-testid="settings-mines">Starting mines: about {startMines}</p>
      )}
    </>
  );
}
