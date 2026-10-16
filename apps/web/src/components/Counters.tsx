import type { Color, FallenView, PublicView } from "@chessweeper/engine";
import { COLOR_NAME, PIECE_NAME } from "../narration";

const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

function FallenRow({ color, fallen }: { color: Color; fallen: readonly FallenView[] }) {
  return (
    <div className="fallen" data-testid={`fallen-${color}`}>
      <span className="fallen-label">{COLOR_NAME[color]} lost:</span>
      {fallen.length === 0 && <span className="fallen-none">none</span>}
      {fallen.map((f, i) => (
        <span
          key={i}
          className={`fallen-piece piece-${color} fallen-${f.cause}`}
          title={`${PIECE_NAME[f.piece]} (${f.cause === "mine" ? "mine" : "captured"})`}
        >
          {GLYPH[f.piece]}
          {f.cause === "mine" ? "*" : ""}
        </span>
      ))}
    </div>
  );
}

function Lives({ color, lives }: { color: Color; lives: number }) {
  return (
    <div className="lives" data-testid={`lives-${color}`}>
      {COLOR_NAME[color]} king lives: <span className="led">{lives}</span>
    </div>
  );
}

export function Counters({ view }: { view: PublicView }) {
  return (
    <div className="counters">
      <div className="counter-row">
        <div>
          Mines:{" "}
          <span className="led" data-testid="mine-count">
            {view.mineCount}
          </span>
        </div>
        <div>
          Reshuffle in:{" "}
          <span className="led" data-testid="reshuffle-count">
            {view.turnsUntilReshuffle}
          </span>
        </div>
      </div>
      <Lives color="w" lives={view.lives.w} />
      <FallenRow color="w" fallen={view.fallen.w} />
      <Lives color="b" lives={view.lives.b} />
      <FallenRow color="b" fallen={view.fallen.b} />
    </div>
  );
}
