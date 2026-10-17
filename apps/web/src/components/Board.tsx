import { useMemo } from "react";
import {
  fileOf,
  rankOf,
  type Color,
  type Flags,
  type PublicView,
  type Square as Sq,
} from "@chessweeper/engine";
import { numberDescription, revealSource } from "../narration";
import { BLAST_RING_MS, type Fx } from "../presentation";
import type { OwnedLayout } from "./placementTypes";
import { Square, type SquareFx } from "./Square";

/** Logical size of one square: a 16px sprite at 2x. */
export const SQUARE_PX = 32;

export interface BoardProps {
  view: PublicView;
  flags: Flags;
  /** Which colour is at the bottom of the board. */
  orientation: Color;
  selected: Sq | null;
  destinations: readonly Sq[];
  /** Final mine layout once the game is over; otherwise empty. */
  mines: readonly Sq[];
  /** Active animation effects and the turn they belong to. */
  fx: readonly Fx[];
  fxKey: number;
  onSquareClick: (square: Sq) => void;
  onSquareFlag: (square: Sq) => void;
  /** A square gained focus (keyboard or pointer); used to show number hints. */
  onSquareFocus?: (square: Sq) => void;
  /** Manual mine mode game over: who placed which mine (overrides `mines`). Big = in both. */
  owned?: OwnedLayout | null;
  /** Manual mine placement: the viewer's own markers, drawn in their colour. */
  marks?: { squares: readonly Sq[]; color: Color } | null;
  /** Squares that cannot be clicked (placement: occupied squares). */
  isDisabled?: (square: Sq) => boolean;
}

/** Square of a colour's king, or null (never null in a real game). */
export function findKing(view: PublicView, color: Color): Sq | null {
  const idx = view.board.findIndex((p) => p?.type === "k" && p.color === color);
  return idx < 0 ? null : idx;
}

const FILES = "abcdefgh";

/** Squares in display order (row by row from the top) for an orientation. */
export function displayOrder(orientation: Color): Sq[] {
  const ranks = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  return ranks.flatMap((rank) => files.map((file) => rank * 8 + file));
}

/** Column and row of a square on screen. */
export function screenPos(square: Sq, orientation: Color): { col: number; row: number } {
  return orientation === "w"
    ? { col: fileOf(square), row: 7 - rankOf(square) }
    : { col: 7 - fileOf(square), row: rankOf(square) };
}

type MineKind = "w" | "b" | "big";

/** Per-square mine owner for an owned layout (game over) or the viewer's placement markers. */
function mineKinds(
  owned: OwnedLayout | null | undefined,
  marks: { squares: readonly Sq[]; color: Color } | null | undefined,
): Map<Sq, MineKind> {
  const out = new Map<Sq, MineKind>();
  if (owned) {
    for (const sq of owned.w) out.set(sq, "w");
    for (const sq of owned.b) out.set(sq, out.get(sq) === "w" ? "big" : "b");
  } else if (marks) {
    for (const sq of marks.squares) out.set(sq, marks.color);
  }
  return out;
}

function buildFx(fx: readonly Fx[], orientation: Color): Map<Sq, SquareFx> {
  const out = new Map<Sq, SquareFx>();
  const at = (sq: Sq): SquareFx => {
    let entry = out.get(sq);
    if (!entry) {
      entry = {};
      out.set(sq, entry);
    }
    return entry;
  };
  for (const f of fx) {
    switch (f.kind) {
      case "slide": {
        const a = screenPos(f.from, orientation);
        const b = screenPos(f.to, orientation);
        at(f.to).slide = {
          dx: (a.col - b.col) * SQUARE_PX,
          dy: (a.row - b.row) * SQUARE_PX,
          delayMs: f.delayMs,
        };
        break;
      }
      case "capture":
        at(f.square).pop = f.piece;
        break;
      case "flip":
        at(f.square).flip = { delayMs: f.delayMs };
        break;
      case "explosion":
        at(f.square).explosion = { delayMs: f.delayMs };
        break;
      case "check":
        at(f.square).checkFlash = true;
        break;
      case "blast":
        for (const sq of f.area) {
          const d = Math.max(
            Math.abs((sq % 8) - (f.square % 8)),
            Math.abs(Math.floor(sq / 8) - Math.floor(f.square / 8)),
          );
          at(sq).explosion = { delayMs: f.delayMs + d * BLAST_RING_MS };
        }
        break;
      case "reshuffle":
      case "mineReveal":
      case "lifeCrack":
        break;
    }
  }
  return out;
}

/** The board for an orientation: White at the bottom for "w", Black for "b". */
export function Board({
  view,
  flags,
  orientation,
  selected,
  destinations,
  mines,
  fx,
  fxKey,
  onSquareClick,
  onSquareFlag,
  onSquareFocus,
  owned,
  marks,
  isDisabled,
}: BoardProps) {
  const last = view.log[view.log.length - 1];
  const moved = last?.events.find((e) => e.type === "MoveMade");
  const lastSquares = moved ? [moved.move.from, moved.move.to] : [];
  const order = useMemo(() => displayOrder(orientation), [orientation]);
  const fxBySquare = useMemo(() => buildFx(fx, orientation), [fx, orientation]);
  const numbers = useMemo(() => new Map(view.revealed.map((r) => [r.square, r.number])), [view]);
  const checkSquare = view.inCheck ? findKing(view, view.turn) : null;
  const wave = fx.some((f) => f.kind === "reshuffle");
  const reveal = fx.some((f) => f.kind === "mineReveal");
  const kinds = useMemo(() => mineKinds(owned, marks), [owned, marks]);
  const shown = owned ? [...kinds.keys()] : mines;
  const mineOrder = new Map(shown.map((m, i) => [m, i]));
  const files = orientation === "w" ? FILES : FILES.split("").reverse().join("");
  const ranks = orientation === "w" ? "87654321" : "12345678";
  return (
    <div className="board-wrap">
      <div className="coords coords-ranks" aria-hidden="true">
        {ranks.split("").map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <div
        className="board"
        role="grid"
        aria-label="Chessweeper board"
        data-orientation={orientation}
      >
        {order.map((sq, i) => {
          const base = fxBySquare.get(sq);
          const sqFx: SquareFx | undefined =
            wave || (reveal && mineOrder.has(sq))
              ? {
                  ...base,
                  ...(wave ? { waveRow: Math.floor(i / 8) } : {}),
                  ...(reveal ? { mineIndex: mineOrder.get(sq) ?? 0 } : {}),
                }
              : base;
          return (
            <Square
              key={sq}
              square={sq}
              piece={view.board[sq] ?? null}
              number={numbers.get(sq) ?? null}
              crater={view.craters.includes(sq)}
              selected={selected === sq}
              destination={destinations.includes(sq)}
              lastMove={lastSquares.includes(sq)}
              check={checkSquare === sq}
              flagged={flags.has(sq)}
              mine={mineOrder.has(sq) || kinds.has(sq)}
              mineKind={kinds.get(sq)}
              disabled={isDisabled?.(sq)}
              fx={sqFx}
              fxKey={fxKey}
              description={numberDescription(
                numbers.get(sq) ?? null,
                view.craters.includes(sq),
                numbers.has(sq) ? revealSource(view, sq) : null,
              )}
              {...(onSquareFocus ? { onFocus: onSquareFocus } : {})}
              onClick={onSquareClick}
              onContextMenu={onSquareFlag}
            />
          );
        })}
      </div>
      <div className="coords coords-files" aria-hidden="true">
        {files.split("").map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
    </div>
  );
}
