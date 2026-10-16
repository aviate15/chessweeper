import { useState } from "react";
import { playCue } from "../audio";
import { DEFAULT_OPTIONS, clampOptions, type GameOptions } from "../settings";
import { Dialog } from "./Dialog";
import { SettingsFields } from "./SettingsFields";

/** Game > New game...: pick the rules values for this game (3.7), then start it. */
export function NewGameDialog({
  settings,
  onStart,
  onClose,
}: {
  settings: GameOptions;
  onStart: (settings: GameOptions) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  return (
    <Dialog title="New game" label="New game" onClose={onClose}>
      <SettingsFields settings={draft} onChange={setDraft} modePicker />
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            setDraft(DEFAULT_OPTIONS);
          }}
        >
          Reset to defaults
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            // Auto games keep `mode` omitted (clampOptions drops an explicit "auto").
            onStart(clampOptions(draft));
          }}
        >
          OK
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
