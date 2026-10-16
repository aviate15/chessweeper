import type { PublicView } from "@chessweeper/engine";
import { COLOR_NAME, narrate } from "../narration";

export function StatusBar({ view }: { view: PublicView }) {
  const last = view.log[view.log.length - 1];
  const narration = last ? narrate(last.events) : "Game started. White to move.";
  const turn =
    view.status.kind === "over"
      ? "Game over"
      : view.checkException !== null
        ? `${COLOR_NAME[view.turn]} must move again`
        : `${COLOR_NAME[view.turn]} to move${view.inCheck ? " (check)" : ""}`;
  return (
    <div className="status-bar" role="status">
      <span data-testid="status-turn">{turn}</span>
      <span className="status-sep"> | </span>
      <span data-testid="status-narration">{narration}</span>
    </div>
  );
}
