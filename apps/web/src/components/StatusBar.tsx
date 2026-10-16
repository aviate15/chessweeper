import type { Color, PublicView } from "@chessweeper/engine";
import { COLOR_NAME, narrate } from "../narration";

export function StatusBar({
  view,
  hint,
  you,
}: {
  view: PublicView;
  hint?: string | null;
  /** Online: the viewer's own colour. */
  you?: Color | null;
}) {
  const last = view.log[view.log.length - 1];
  const narration = last ? narrate(last.events) : "Game started. White to move.";
  const turn =
    view.status.kind === "over"
      ? "Game over"
      : view.checkException !== null
        ? `${COLOR_NAME[view.turn]} must move again`
        : `${COLOR_NAME[view.turn]} to move${view.inCheck ? " (check)" : ""}`;
  const text = hint ?? narration;
  return (
    <div className="status-bar" role="status">
      <span data-testid="status-turn" className="status-fixed">
        {turn}
      </span>
      <span data-testid="status-settings" className="status-fixed">
        <span className="status-sep"> | </span>
        Reshuffle {view.settings.reshuffleInterval} · Mines {view.settings.densityPercent}%
      </span>
      <span className="status-fixed status-sep"> | </span>
      <span data-testid="status-narration" className="status-narration" title={text}>
        {text}
      </span>
      {you != null && (
        <span data-testid="status-you" className="status-fixed">
          <span className="status-sep"> | </span>You: {COLOR_NAME[you]}
        </span>
      )}
    </div>
  );
}
