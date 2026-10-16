import { playCue } from "../audio";
import { Dialog } from "./Dialog";

export type ConfirmKind =
  "resign" | "offerDraw" | "acceptDraw" | "declineDraw" | "claimWin" | "leave";

const COPY: Record<ConfirmKind, { title: string; text: string; ok: string }> = {
  resign: { title: "Resign", text: "Resign this game? Your opponent wins.", ok: "Resign" },
  offerDraw: { title: "Offer draw", text: "Offer your opponent a draw?", ok: "Offer draw" },
  acceptDraw: {
    title: "Accept draw",
    text: "Accept the draw offer? The game ends as a draw.",
    ok: "Accept draw",
  },
  declineDraw: { title: "Decline draw", text: "Decline the draw offer?", ok: "Decline draw" },
  claimWin: {
    title: "Claim win",
    text: "Your opponent has not come back. Claim the win and end the game?",
    ok: "Claim win",
  },
  leave: {
    title: "Leave game",
    text: "You are still in a game. Leaving resigns it. Resign and leave?",
    ok: "Resign and leave",
  },
};

/** OK / Cancel confirmation for actions that cannot be undone online. */
export function ConfirmDialog({
  kind,
  onConfirm,
  onCancel,
}: {
  kind: ConfirmKind;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = COPY[kind];
  return (
    <Dialog title={copy.title} label={copy.title} onClose={onCancel}>
      <p>{copy.text}</p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onConfirm();
          }}
        >
          {copy.ok}
        </button>
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
