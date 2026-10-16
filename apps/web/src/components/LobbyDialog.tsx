import { useState } from "react";
import { playCue } from "../audio";
import { isValidCode, normalizeCode } from "../online/code";
import { Dialog } from "./Dialog";

/** Game > Online...: create a game, or join one with a 6-character invite code. */
export function LobbyDialog({
  initialCode = "",
  error,
  onCreate,
  onJoin,
  onClose,
}: {
  initialCode?: string;
  error: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const valid = isValidCode(code);
  return (
    <Dialog title="Online" label="Online" onClose={onClose}>
      {error !== null && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
      <p>Start a new game and send the code to a friend:</p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onCreate();
          }}
        >
          Create game
        </button>
      </div>
      <hr className="dialog-rule" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          playCue("click");
          onJoin(code);
        }}
      >
        <div className="options-field">
          <label htmlFor="join-code">Invite code</label>
          <input
            id="join-code"
            className="retro-input"
            value={code}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => {
              setCode(normalizeCode(e.target.value));
            }}
          />
        </div>
        <div className="dialog-buttons">
          <button type="submit" className="btn" disabled={!valid}>
            Join game
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
      </form>
    </Dialog>
  );
}
