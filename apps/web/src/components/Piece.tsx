import type { PieceView } from "@chessweeper/engine";
import { PIECE_NAME } from "../narration";

const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export function Piece({ piece }: { piece: PieceView }) {
  return (
    <span className={`piece piece-${piece.color}`} data-piece={`${piece.color}${piece.type}`}>
      {GLYPH[piece.type]}
      <span className="sr-only">
        {piece.color === "w" ? "white" : "black"} {PIECE_NAME[piece.type]}
      </span>
    </span>
  );
}
