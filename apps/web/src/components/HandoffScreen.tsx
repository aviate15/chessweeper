import type { Color } from "@chessweeper/engine";
import { playCue } from "../audio";
import { COLOR_NAME } from "../narration";
import { Dialog } from "./Dialog";

/** Hides the board between turns so the next player cannot see the last player's flags. */
export function HandoffScreen({
  to,
  onReady,
  placing = false,
}: {
  to: Color;
  onReady: () => void;
  /** Manual mine mode: the next player places mines instead of moving (3.10). */
  placing?: boolean;
}) {
  return (
    <Dialog title="Pass the device" label="Pass the device" className="handoff">
      <p>
        Pass to {COLOR_NAME[to]}
        {placing ? " to place mines" : ""}
      </p>
      <p>Hand the device over, then press Ready.</p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onReady();
          }}
        >
          Ready
        </button>
      </div>
    </Dialog>
  );
}
