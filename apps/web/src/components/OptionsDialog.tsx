import { mineCountFor } from "@chessweeper/engine";
import { useState } from "react";
import { playCue } from "../audio";
import {
  DEFAULT_OPTIONS,
  DENSITY_MAX,
  DENSITY_MIN,
  DENSITY_STEP,
  INTERVAL_MAX,
  INTERVAL_MIN,
  clampOptions,
  configFromOptions,
  type GameOptions,
} from "../settings";
import { Dialog } from "./Dialog";

const range = (lo: number, hi: number, step: number) =>
  Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

/** Game > Options: rules values that apply at the next New game, never mid-game. */
export function OptionsDialog({
  options,
  onSave,
  onClose,
}: {
  options: GameOptions;
  onSave: (options: GameOptions) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(options);
  const update = (patch: Partial<GameOptions>) => {
    const next = clampOptions({ ...draft, ...patch });
    setDraft(next);
    onSave(next);
  };
  const startMines = mineCountFor(32, configFromOptions(draft));
  return (
    <Dialog title="Options" label="Options" onClose={onClose}>
      <div className="options-field">
        <label htmlFor="opt-interval">Reshuffle every</label>
        <select
          id="opt-interval"
          className="retro-select"
          value={draft.reshuffleInterval}
          onChange={(e) => {
            update({ reshuffleInterval: Number(e.target.value) });
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
        <label htmlFor="opt-density">Mine density</label>
        <select
          id="opt-density"
          className="retro-select"
          value={draft.densityPercent}
          onChange={(e) => {
            update({ densityPercent: Number(e.target.value) });
          }}
        >
          {range(DENSITY_MIN, DENSITY_MAX, DENSITY_STEP).map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </div>
      <p data-testid="options-mines">Starting mines: {startMines}</p>
      <p className="dialog-note">Applies at the next New game.</p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            setDraft(DEFAULT_OPTIONS);
            onSave(DEFAULT_OPTIONS);
          }}
        >
          Reset to defaults
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onClose();
          }}
        >
          OK
        </button>
      </div>
    </Dialog>
  );
}
