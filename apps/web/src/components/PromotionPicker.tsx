import type { Color, PromotionPiece } from "@chessweeper/engine";
import { playCue } from "../audio";
import { PIECE_NAME } from "../narration";
import { PIECE_SPRITES } from "../sprites";
import { Dialog } from "./Dialog";
import { Px } from "./Px";

const CHOICES: readonly PromotionPiece[] = ["q", "r", "b", "n"];

export function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title="Promote to" label="Promote pawn" onClose={onCancel}>
      <div className="dialog-buttons">
        {CHOICES.map((p) => (
          <button
            key={p}
            type="button"
            className="btn btn-piece"
            onClick={() => {
              playCue("click");
              onPick(p);
            }}
          >
            <Px sprite={PIECE_SPRITES[`${color}${p}`]} className="btn-piece-sprite" />
            <span>{PIECE_NAME[p]}</span>
          </button>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
