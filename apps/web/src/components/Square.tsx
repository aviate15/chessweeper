import { fileOf, rankOf, squareName, type PieceView, type Square as Sq } from "@chessweeper/engine";
import { Piece } from "./Piece";

export interface SquareProps {
  square: Sq;
  piece: PieceView | null;
  /** Revealed number, or null when hidden. */
  number: number | null;
  crater: boolean;
  selected: boolean;
  /** A legal destination of the selected piece (a dot; never hints at mines). */
  destination: boolean;
  lastMove: boolean;
  flagged: boolean;
  /** Final mine layout, only passed once the game is over. */
  mine: boolean;
  onClick: (square: Sq) => void;
  onContextMenu: (square: Sq) => void;
}

export function Square(props: SquareProps) {
  const { square, piece, number } = props;
  const name = squareName(square);
  const dark = (fileOf(square) + rankOf(square)) % 2 === 0;
  const classes = [
    "square",
    dark ? "square-dark" : "square-light",
    number !== null || props.crater ? "square-revealed" : "",
    props.selected ? "square-selected" : "",
    props.lastMove ? "square-last" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      data-square={name}
      data-number={number ?? undefined}
      data-crater={props.crater || undefined}
      data-flagged={props.flagged || undefined}
      data-mine={props.mine || undefined}
      data-destination={props.destination || undefined}
      aria-label={name}
      onClick={() => {
        props.onClick(square);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        props.onContextMenu(square);
      }}
    >
      {props.crater && <span className="mark mark-crater">{"○"}</span>}
      {props.mine && <span className="mark mark-mine">*</span>}
      {piece && <Piece piece={piece} />}
      {number !== null && <span className="corner-number">{number}</span>}
      {props.flagged && <span className="mark mark-flag">{"⚑"}</span>}
      {props.destination && <span className="dot" />}
    </button>
  );
}
