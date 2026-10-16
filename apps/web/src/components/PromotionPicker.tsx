import type { PromotionPiece } from "@chessweeper/engine";
import { PIECE_NAME } from "../narration";

const CHOICES: readonly PromotionPiece[] = ["q", "r", "b", "n"];

export function PromotionPicker({
  onPick,
  onCancel,
}: {
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog" role="dialog" aria-label="Promote pawn">
      <h2 className="dialog-title">Promote to</h2>
      <div className="dialog-buttons">
        {CHOICES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onPick(p);
            }}
          >
            {PIECE_NAME[p]}
          </button>
        ))}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
