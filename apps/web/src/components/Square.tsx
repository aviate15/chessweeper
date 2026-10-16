import type { CSSProperties } from "react";
import { fileOf, rankOf, squareName, type PieceView, type Square as Sq } from "@chessweeper/engine";
import { PIECE_NAME } from "../narration";
import {
  EXPLOSION_FRAMES,
  FLAG,
  MINE,
  NUMBER_SPRITES,
  OVERLAY_CHECK,
  OVERLAY_LAST_MOVE,
  OVERLAY_LEGAL_DOT,
  OVERLAY_SELECTED,
  PIECE_SPRITES,
  TILE_CRATER,
  TILE_HIDDEN_DARK,
  TILE_HIDDEN_LIGHT,
  TILE_REVEALED,
} from "../sprites";
import { Px } from "./Px";

/** Per-square animation inputs, all optional so a quiet square renders no effect layers. */
export interface SquareFx {
  /** Slide the piece in from this offset (logical px). */
  slide?: { dx: number; dy: number; delayMs: number };
  /** A captured piece popping out. */
  pop?: PieceView;
  flip?: { delayMs: number };
  explosion?: { delayMs: number };
  checkFlash?: boolean;
  /** Reshuffle wave row (0 = first displayed row). */
  waveRow?: number;
  /** Order of this mine in the staggered game-over reveal. */
  mineIndex?: number;
}

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
  /** The king of the side to move is in check on this square. */
  check: boolean;
  flagged: boolean;
  /** Final mine layout, only passed once the game is over. */
  mine: boolean;
  fx: SquareFx | undefined;
  /** Changes every turn so effect layers restart their CSS animation. */
  fxKey: number;
  onClick: (square: Sq) => void;
  onContextMenu: (square: Sq) => void;
}

const delay = (ms: number | undefined) => (ms ? { animationDelay: `${String(ms)}ms` } : {});

export function Square(props: SquareProps) {
  const { square, piece, number, fx } = props;
  const name = squareName(square);
  const dark = (fileOf(square) + rankOf(square)) % 2 === 0;
  const revealed = number !== null || props.crater;
  const tile = props.crater
    ? TILE_CRATER
    : revealed || props.mine
      ? TILE_REVEALED
      : dark
        ? TILE_HIDDEN_DARK
        : TILE_HIDDEN_LIGHT;
  const numberSprite = number !== null && number > 0 ? NUMBER_SPRITES[number - 1] : undefined;
  const explosion = fx?.explosion;
  const waveRow = fx?.waveRow;
  const hasWave = waveRow !== undefined;
  const classes = [
    "square",
    revealed ? "square-revealed" : "",
    props.selected ? "square-selected" : "",
    props.lastMove ? "square-last" : "",
    hasWave ? "fx-wave" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      style={hasWave ? { animationDelay: `${String(waveRow * 30)}ms` } : undefined}
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
      <Px sprite={tile} className="layer" />
      {props.lastMove && <Px sprite={OVERLAY_LAST_MOVE} className="layer" />}
      {props.selected && <Px sprite={OVERLAY_SELECTED} className="layer" />}
      {props.mine && (
        <Px
          sprite={MINE}
          className={fx?.mineIndex === undefined ? "layer" : "layer fx-mine"}
          style={
            fx?.mineIndex === undefined
              ? undefined
              : { animationDelay: `${String(fx.mineIndex * 40)}ms` }
          }
        />
      )}
      {numberSprite && (
        <Px
          key={`n${String(props.fxKey)}`}
          sprite={numberSprite}
          className={[piece ? "layer layer-corner" : "layer", fx?.flip ? "fx-flip" : ""].join(" ")}
          style={delay(fx?.flip?.delayMs)}
        />
      )}
      {piece && (
        <span
          key={`p${String(props.fxKey)}`}
          className={fx?.slide ? "piece fx-slide" : "piece"}
          data-piece={`${piece.color}${piece.type}`}
          style={
            fx?.slide
              ? ({
                  "--dx": `${String(fx.slide.dx)}px`,
                  "--dy": `${String(fx.slide.dy)}px`,
                  ...delay(fx.slide.delayMs),
                } as unknown as CSSProperties)
              : undefined
          }
        >
          <Px sprite={PIECE_SPRITES[`${piece.color}${piece.type}`]} className="layer" />
          <span className="sr-only">
            {piece.color === "w" ? "white" : "black"} {PIECE_NAME[piece.type]}
          </span>
        </span>
      )}
      {props.check && (
        <Px
          key={`c${String(props.fxKey)}`}
          sprite={OVERLAY_CHECK}
          className={fx?.checkFlash ? "layer fx-check" : "layer"}
        />
      )}
      {props.flagged && <Px sprite={FLAG} className="layer" />}
      {props.destination && <Px sprite={OVERLAY_LEGAL_DOT} className="layer" />}
      {fx?.pop && (
        <Px
          key={`x${String(props.fxKey)}`}
          sprite={PIECE_SPRITES[`${fx.pop.color}${fx.pop.type}`]}
          className="layer fx-pop"
        />
      )}
      {explosion && (
        <span key={`e${String(props.fxKey)}`} className="fx-explosion" aria-hidden="true">
          <span className="fx-flash" style={delay(explosion.delayMs)} />
          {EXPLOSION_FRAMES.map((frame, i) => (
            <Px
              key={i}
              sprite={frame}
              className="layer fx-frame"
              style={{ animationDelay: `${String(explosion.delayMs + i * 80)}ms` }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
