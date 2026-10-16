import { squareName, type GameOverView } from "@chessweeper/engine";
import { REASON_TEXT, resultText } from "../narration";

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
    <div className="dialog" role="dialog" aria-label="Game over">
      <h2 className="dialog-title">Game over</h2>
      <p data-testid="gameover-result">{resultText(status.result)}</p>
      <p data-testid="gameover-reason">By {REASON_TEXT[status.reason]}</p>
      <p data-testid="gameover-mines">
        Mines ({gameOver.mines.length}): {gameOver.mines.map(squareName).join(", ") || "none"}
      </p>
      <div className="dialog-buttons">
        <button type="button" onClick={onNewGame}>
          New game
        </button>
        <button type="button" onClick={onClose}>
          View board
        </button>
      </div>
    </div>
  );
}
