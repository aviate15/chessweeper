import type { Color } from "@chessweeper/engine";
import { COLOR_NAME } from "../narration";

/** Hides the board between turns so the next player cannot see the last player's flags. */
export function HandoffScreen({ to, onReady }: { to: Color; onReady: () => void }) {
  return (
    <div className="handoff" role="dialog" aria-label="Pass the device">
      <h2 className="dialog-title">Pass to {COLOR_NAME[to]}</h2>
      <p>Hand the device over, then press Ready.</p>
      <button type="button" onClick={onReady}>
        Ready
      </button>
    </div>
  );
}
