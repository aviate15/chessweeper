import type { Flags, PublicView, Square as Sq } from "@chessweeper/engine";
import { Square } from "./Square";

export interface BoardProps {
  view: PublicView;
  flags: Flags;
  selected: Sq | null;
  destinations: readonly Sq[];
  /** Final mine layout once the game is over; otherwise empty. */
  mines: readonly Sq[];
  onSquareClick: (square: Sq) => void;
  onSquareFlag: (square: Sq) => void;
}

/** White at the bottom: rank 8 on top, file a on the left. */
export function Board({
  view,
  flags,
  selected,
  destinations,
  mines,
  onSquareClick,
  onSquareFlag,
}: BoardProps) {
  const last = view.log[view.log.length - 1];
  const moved = last?.events.find((e) => e.type === "MoveMade");
  const lastSquares = moved ? [moved.move.from, moved.move.to] : [];
  const rows = [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="board" role="grid" aria-label="Chessweeper board">
      {rows.flatMap((rank) =>
        cols.map((file) => {
          const sq = rank * 8 + file;
          return (
            <Square
              key={sq}
              square={sq}
              piece={view.board[sq] ?? null}
              number={view.revealed.find((r) => r.square === sq)?.number ?? null}
              crater={view.craters.includes(sq)}
              selected={selected === sq}
              destination={destinations.includes(sq)}
              lastMove={lastSquares.includes(sq)}
              flagged={flags.has(sq)}
              mine={mines.includes(sq)}
              onClick={onSquareClick}
              onContextMenu={onSquareFlag}
            />
          );
        }),
      )}
    </div>
  );
}
