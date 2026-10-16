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

const range = (lo: number, hi: number, step: number) =>
  Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

/** One-line summary of a game's settings, shown to both players (3.7). */
export function settingsSummary(settings: GameSettings): string {
  return `Reshuffle every ${String(settings.reshuffleInterval)} turns, mine density ${String(settings.densityPercent)}%`;
}

/** The two per-game choices: reshuffle interval and mine density (3.7). */
export function SettingsFields({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
}) {
  const id = useId();
  const startMines = mineCountFor(32, configFromOptions(settings));
  return (
    <>
      <div className="options-field">
        <label htmlFor={`${id}-interval`}>Reshuffle every</label>
        <select
          id={`${id}-interval`}
          className="retro-select"
          value={settings.reshuffleInterval}
          onChange={(e) => {
            onChange(clampOptions({ ...settings, reshuffleInterval: Number(e.target.value) }));
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
            onChange(clampOptions({ ...settings, densityPercent: Number(e.target.value) }));
          }}
        >
          {range(DENSITY_MIN, DENSITY_MAX, DENSITY_STEP).map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </div>
      <p data-testid="settings-mines">Starting mines: about {startMines}</p>
    </>
  );
}
