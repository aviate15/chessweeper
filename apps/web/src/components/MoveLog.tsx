import { useEffect, type RefObject } from "react";
import type { PublicView } from "@chessweeper/engine";
import { COLOR_NAME, narrate } from "../narration";

/** Scrolling move log, newest at the bottom, built from the public log. */
export function MoveLog({
  view,
  logRef,
}: {
  view: PublicView;
  logRef: RefObject<HTMLElement | null>;
}) {
  const count = view.log.length;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, logRef]);
  return (
    <section className="movelog" aria-label="Moves" tabIndex={-1} ref={logRef}>
      <h2 className="movelog-title">Moves</h2>
      {count === 0 ? (
        <p className="movelog-empty">No moves yet.</p>
      ) : (
        <ol className="moves-list">
          {view.log.map((entry, i) => (
            <li key={i}>
              <strong>{COLOR_NAME[entry.color]}:</strong> {narrate(entry.events)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
