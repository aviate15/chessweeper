import { useEffect, useRef, type RefObject } from "react";
import type { PublicView } from "@chessweeper/engine";
import { COLOR_NAME, narrate } from "../narration";
import { BADGE_LEGEND } from "../sprites";
import { Px } from "./Px";

/** Scrolling move log, newest at the bottom, built from the public log. */
export function MoveLog({
  view,
  logRef,
}: {
  view: PublicView;
  logRef: RefObject<HTMLElement | null>;
}) {
  const count = view.log.length;
  // Stick to the newest entry only while the reader is already at the bottom.
  const stick = useRef(true);
  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count, logRef]);
  const onScroll = () => {
    const el = logRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 4;
  };
  return (
    <div className="log-col">
      <section
        className="movelog"
        aria-label="Moves"
        tabIndex={-1}
        ref={logRef}
        onScroll={onScroll}
      >
        <h2 className="movelog-title">Moves</h2>
        {count === 0 ? (
          <p className="movelog-empty">No moves yet.</p>
        ) : (
          <ol className="moves-list">
            {view.log.map((entry, i) => (
              <li key={i}>
                <span className="move-no">{String(i + 1)}.</span>{" "}
                <strong>{COLOR_NAME[entry.color]}:</strong> {narrate(entry.events)}
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="log-legend">
        <Px sprite={BADGE_LEGEND} className="legend-badge" />
        <span>= mines next to this square</span>
      </p>
    </div>
  );
}
