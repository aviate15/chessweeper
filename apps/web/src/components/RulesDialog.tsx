import { mineCountFor, type GameConfig, type PieceView } from "@chessweeper/engine";
import { useState, type ReactNode } from "react";
import { playCue } from "../audio";
import { Dialog } from "./Dialog";
import { Square } from "./Square";

interface MiniCell {
  piece?: PieceView;
  number?: number;
  crater?: boolean;
  flagged?: boolean;
}

/** A tiny example board built from the real Square component. Rows are listed top to bottom. */
export function MiniBoard({
  label,
  rows,
}: {
  label: string;
  rows: readonly (readonly MiniCell[])[];
}) {
  const cols = rows[0]?.length ?? 0;
  return (
    <div
      className="mini-board"
      role="img"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${String(cols)}, var(--square))` }}
    >
      {rows.flatMap((row, r) =>
        row.map((cell, c) => (
          <div className="mini-cell" inert key={`${String(r)}-${String(c)}`}>
            <Square
              square={(r * 3 + c) % 2 === 0 ? 0 : 1}
              piece={cell.piece ?? null}
              number={cell.number ?? null}
              crater={cell.crater ?? false}
              selected={false}
              destination={false}
              lastMove={false}
              check={false}
              flagged={cell.flagged ?? false}
              mine={false}
              fx={undefined}
              fxKey={0}
              onClick={() => undefined}
              onContextMenu={() => undefined}
            />
          </div>
        )),
      )}
    </div>
  );
}

const H: MiniCell = {};

function Example({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="rules-example">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** Rules page. Text is condensed from docs/GAME_DESIGN.md section 3 only. */
export function RulesDialog({
  config,
  onClose,
}: {
  config: GameConfig;
  onClose: (dontShowAgain: boolean) => void;
}) {
  const [hide, setHide] = useState(false);
  const startMines = mineCountFor(32, config);
  const percent = Math.round(config.mineDensity * 100);
  return (
    <Dialog
      title="How to play"
      label="Rules"
      className="dialog-rules"
      onClose={() => {
        onClose(hide);
      }}
    >
      <div className="rules-scroll" tabIndex={0} role="region" aria-label="Rules text">
        <h3>Goal</h3>
        <p>
          Chess with hidden mines. Win by checkmating the other king, or when the other king runs
          out of lives.
        </p>

        <h3>Mines and numbers</h3>
        <ul>
          <li>
            About {startMines} mines start hidden on ranks 3-6, never under a piece. Each
            player&apos;s first move of the game can never hit a mine.
          </li>
          <li>
            A number appears when a piece lands on a square and survives. That includes captures,
            both castling squares, en passant, promotion and craters.
          </li>
          <li>The number counts the mines in the 8 squares around it. Both players see it.</li>
          <li>Pieces only passing over a square reveal nothing. Starting squares start hidden.</li>
          <li>Landing on a 0 reveals only that square.</li>
          <li>
            A number stays until the next reshuffle, even after the piece leaves. It is live: it
            drops when a neighbouring mine is used up.
          </li>
        </ul>
        <div className="rules-examples">
          <Example caption="A 2: two of the 8 squares around it hold mines.">
            <MiniBoard
              label="Example: a revealed 2 surrounded by hidden squares"
              rows={[
                [H, H, H],
                [H, { number: 2 }, H],
                [H, H, H],
              ]}
            />
          </Example>
          <Example caption="A piece on a number shows it in a small badge.">
            <MiniBoard
              label="Example: a white knight standing on a 3, with the number in a corner badge"
              rows={[
                [H, H, H],
                [H, { piece: { color: "w", type: "n" }, number: 3 }, H],
                [H, H, H],
              ]}
            />
          </Example>
        </div>

        <h3>Exploding and craters</h3>
        <ul>
          <li>
            A non-king piece that lands on a live mine is destroyed. The move is wasted and play
            passes to the opponent.
          </li>
          <li>
            The mine is used up and leaves a public crater. Pieces can land on a crater safely, and
            its number is shown as usual.
          </li>
        </ul>
        <div className="rules-examples">
          <Example caption="A crater, and a crater with its number revealed.">
            <MiniBoard
              label="Example: an empty crater next to a crater that shows a 1"
              rows={[
                [{ crater: true }, { crater: true, number: 1 }, H],
                [H, H, H],
                [H, H, H],
              ]}
            />
          </Example>
        </div>

        <h3>King lives</h3>
        <ul>
          <li>Each king has 3 lives.</li>
          <li>
            A king that lands on a live mine loses 1 life, the mine is used up, and the king stays
            on that square.
          </li>
          <li>
            If the king&apos;s only escape square is mined, it can still go there and pays a life.
          </li>
          <li>A king with 0 lives loses.</li>
        </ul>

        <h3>The check exception</h3>
        <p>
          If your piece blows up and that leaves your own king in check, you do not lose your turn.
          You must move again right away to resolve the check. If you cannot, it is checkmate and
          you lose. The follow-up move can hit another mine. The explosion and its follow-ups count
          as one turn.
        </p>

        <h3>Special moves on mines</h3>
        <ul>
          <li>
            Castling, en passant and promotion follow standard chess rules. If one lands on a mine,
            the piece pays the price like any other landing.
          </li>
          <li>
            Castling: the king&apos;s and the rook&apos;s landing squares can each hold a mine.
          </li>
          <li>
            En passant: if the square behind the captured pawn is mined, the capturing pawn is
            destroyed. The captured pawn is still removed.
          </li>
          <li>
            Promotion: if the promotion square is mined, the pawn is destroyed and does not promote.
          </li>
          <li>Normal captures never hit a mine.</li>
        </ul>

        <h3>Flags</h3>
        <p>
          Right-click (or use Flag mode) to flag a suspected mine. Flags are private notes: the
          opponent cannot see them, and they have no effect on the rules.
        </p>

        <h3>The reshuffle</h3>
        <ul>
          <li>
            After {config.reshuffleInterval} turns in a row without a capture (counting both
            players), all mines are reshuffled. The reshuffle countdown is always shown.
          </li>
          <li>
            The new mine count is {percent}% of the empty squares at that moment, rounded half up.
            Mines can land on any empty square, on any rank.
          </li>
          <li>All numbers are hidden again, and craters and flags are cleared.</li>
        </ul>

        <h3>How the game ends</h3>
        <ul>
          <li>
            A king loses its last life: that side loses, even if the same move gave checkmate.
          </li>
          <li>
            Checkmate, judged by standard chess rules. Hidden mines are ignored, so a mined escape
            square still counts as an escape.
          </li>
          <li>Stalemate is a draw.</li>
          <li>You can resign, or offer a draw that the opponent accepts or declines.</li>
          <li>
            Online, a player who is away for more than 60 seconds can lose by abandonment. There are
            no clocks and no other automatic draws.
          </li>
          <li>When the game ends, all mines are revealed.</li>
        </ul>
      </div>
      <label className="rules-hide">
        <input
          type="checkbox"
          checked={hide}
          onChange={(e) => {
            setHide(e.target.checked);
          }}
        />
        <span>Don&apos;t show again</span>
      </label>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onClose(hide);
          }}
        >
          OK
        </button>
      </div>
    </Dialog>
  );
}
