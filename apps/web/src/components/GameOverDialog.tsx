import { squareName, type GameOverView } from "@chessweeper/engine";
import { playCue } from "../audio";
import { REASON_TEXT, resultText } from "../narration";
import { MINE } from "../sprites";
import { Dialog } from "./Dialog";
import { Px } from "./Px";

export function GameOverDialog({
  gameOver,
  onNewGame,
  onClose,
}: {
  gameOver: GameOverView;
  onNewGame: () => void;
  onClose: () => void;
}) {
  const status = gameOver.view.status;
  if (status.kind !== "over") return null;
  return (
    <Dialog title="Game over" label="Game over">
      <div className="dialog-row">
        <Px sprite={MINE} className="dialog-icon" />
        <div>
          <p data-testid="gameover-result">{resultText(status.result)}</p>
          <p data-testid="gameover-reason">By {REASON_TEXT[status.reason]}</p>
        </div>
      </div>
      <p data-testid="gameover-mines">
        Mines ({gameOver.mines.length}): {gameOver.mines.map(squareName).join(", ") || "none"}
      </p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onNewGame();
          }}
        >
          New game
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onClose();
          }}
        >
          View board
        </button>
      </div>
    </Dialog>
  );
}
