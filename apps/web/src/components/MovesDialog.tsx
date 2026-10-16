import type { PublicView } from "@chessweeper/engine";
import { COLOR_NAME, narrate } from "../narration";

export function MovesDialog({ view, onClose }: { view: PublicView; onClose: () => void }) {
  return (
    <div className="dialog" role="dialog" aria-label="Moves">
      <h2 className="dialog-title">Moves</h2>
      {view.log.length === 0 ? (
        <p>No moves yet.</p>
      ) : (
        <ol className="moves-list">
          {view.log.map((entry, i) => (
            <li key={i}>
              <strong>{COLOR_NAME[entry.color]}:</strong> {narrate(entry.events)}
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
