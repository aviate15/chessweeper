import type { Color, Flags, Square as Sq } from "@chessweeper/engine";
import type { ReactNode } from "react";
import { playCue } from "../audio";
import { COLOR_NAME } from "../narration";
import { Board } from "./Board";
import { Led } from "./Led";
import type { PlacementView } from "./placementTypes";

const NO_FLAGS: Flags = new Set<Sq>();
const NO_SQUARES: readonly Sq[] = [];

/** The countdown blinks red at this many seconds left or fewer. */
export const COUNTDOWN_WARN_SECONDS = 5;

export interface PlacementScreenProps {
  view: PlacementView;
  /** Milliseconds left in the round, or null when there is no timer (local play). */
  msLeft: number | null;
  onToggle: (square: Sq) => void;
  onDone: () => void;
  /** Mines the server placed at random for this player last round; shown as a notice. */
  autoPlaced: number | null;
  /** Whose mines are being placed. Defaults to the view's seat, then White. */
  color?: Color;
  /** Resigning and draw offers are allowed during placement (3.10): the pending offer bar. */
  drawOffer?: ReactNode;
}

/** Manual mine mode (3.10): the placement phase. The player marks their own mines, then is Done. */
export function PlacementScreen({
  view,
  msLeft,
  onToggle,
  onDone,
  autoPlaced,
  color,
  drawOffer,
}: PlacementScreenProps) {
  const me: Color = color ?? view.viewer ?? "w";
  const opponent: Color = me === "w" ? "b" : "w";
  const placement = view.placement;
  const quota = placement?.quota ?? 0;
  const own = placement?.own ?? NO_SQUARES;
  const iAmReady = placement?.ready[me] ?? false;
  const opponentReady = placement?.ready[opponent] ?? false;
  const seconds = msLeft === null ? null : Math.max(0, Math.ceil(msLeft / 1000));
  const warn = seconds !== null && seconds <= COUNTDOWN_WARN_SECONDS;
  const ownSet = new Set(own);
  return (
    <>
      <div className="infobar placement-bar">
        <div className="infobar-top">
          <div className="infobar-cell">
            <Led value={own.length} label="Mines placed" testId="placement-placed" />
            <span className="led-caption" data-testid="placement-quota">
              Placed of {quota}
            </span>
          </div>
          <span className="placement-title">Place your mines</span>
          {seconds !== null && (
            <div className="infobar-cell">
              <Led value={seconds} label="Seconds left" testId="placement-countdown" blink={warn} />
              <span className="led-caption">Seconds</span>
            </div>
          )}
          {drawOffer}
        </div>
      </div>
      <div className="window-body">
        <Board
          view={view}
          flags={NO_FLAGS}
          orientation={me}
          selected={null}
          destinations={NO_SQUARES}
          mines={NO_SQUARES}
          fx={[]}
          fxKey={0}
          marks={{ squares: own, color: me }}
          isDisabled={(sq) => view.board[sq] !== null || iAmReady}
          onSquareClick={(sq) => {
            if (view.board[sq] !== null || iAmReady) return;
            playCue(ownSet.has(sq) ? "click" : "flag");
            onToggle(sq);
          }}
          onSquareFlag={() => undefined}
        />
        <div className="placement-side">
          <p>
            {COLOR_NAME[me]}: click an empty square to place or remove one of your mines. The other
            player cannot see them.
          </p>
          {autoPlaced !== null && autoPlaced > 0 && (
            <p className="placement-notice" role="status">
              {autoPlaced} {autoPlaced === 1 ? "mine was" : "mines were"} placed at random
            </p>
          )}
          <button
            type="button"
            className="btn"
            disabled={iAmReady}
            onClick={() => {
              playCue("click");
              onDone();
            }}
          >
            Done
          </button>
          <p role="status" data-testid="placement-status">
            {opponentReady ? "Opponent ready" : "Opponent placing..."}
          </p>
        </div>
      </div>
    </>
  );
}
