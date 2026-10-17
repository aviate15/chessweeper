import { opponent, type Color, type FallenView, type PublicView } from "@chessweeper/engine";
import { playCue } from "../audio";
import { COLOR_NAME, PIECE_NAME } from "../narration";
import {
  FACE_COOL,
  FACE_DEAD,
  FACE_NORMAL,
  FACE_OOH,
  ICON_FLAG_MODE,
  LED_AMBER,
  LIFE_CRACKED,
  LIFE_FULL,
  PALETTE,
  PIECE_SPRITES,
  type Sprite,
} from "../sprites";
import { Led } from "./Led";
import { Px } from "./Px";

export type FaceKind = "normal" | "ooh" | "dead" | "cool";

const FACES: Record<FaceKind, Sprite> = {
  normal: FACE_NORMAL,
  ooh: FACE_OOH,
  dead: FACE_DEAD,
  cool: FACE_COOL,
};

/** Smiley state: surprised while a piece is held, dead on king death, shades for the winner. */
export function faceFor(view: PublicView, selected: boolean): FaceKind {
  if (view.status.kind === "over") {
    if (view.status.result === "draw") return "normal";
    return view.status.reason === "king-lives" ? "dead" : "cool";
  }
  return selected ? "ooh" : "normal";
}

function FallenRow({ color, fallen }: { color: Color; fallen: readonly FallenView[] }) {
  return (
    <div className="fallen" data-testid={`fallen-${color}`}>
      <span className="sr-only">
        {COLOR_NAME[color]} lost:{" "}
        {fallen.length === 0
          ? "none"
          : fallen
              .map((f) => `${PIECE_NAME[f.piece]} (${f.cause === "mine" ? "mine" : "captured"})`)
              .join(", ")}
      </span>
      {fallen.map((f, i) => (
        <span
          key={i}
          className={`fallen-piece fallen-${f.cause}`}
          title={`${PIECE_NAME[f.piece]} (${f.cause === "mine" ? "killed by a mine" : "captured"})`}
        >
          <Px sprite={PIECE_SPRITES[`${color}${f.piece}`]} className="fallen-sprite" />
        </span>
      ))}
    </div>
  );
}

function SidePanel({
  color,
  view,
  cracking,
}: {
  color: Color;
  view: PublicView;
  cracking: boolean;
}) {
  const lives = view.lives[color];
  return (
    <section
      className={view.turn === color && view.status.kind !== "over" ? "side side-active" : "side"}
      aria-label={`${COLOR_NAME[color]} panel`}
    >
      <div className="side-head">
        <span className="side-name">{COLOR_NAME[color]}</span>
        <span className="lives" data-testid={`lives-${color}`}>
          <span className="sr-only">
            {COLOR_NAME[color]} king lives: {String(lives)}
          </span>
          {[0, 1, 2].map((i) => (
            <Px
              key={i}
              sprite={i < lives ? LIFE_FULL : LIFE_CRACKED}
              className={cracking && i === lives ? "life fx-crack" : "life"}
            />
          ))}
        </span>
      </div>
      <FallenRow color={color} fallen={view.fallen[color]} />
    </section>
  );
}

export interface InfoBarProps {
  view: PublicView;
  face: FaceKind;
  flagMode: boolean;
  /** Colour whose king just lost a life, while its crack animation runs. */
  crackColor: Color | null;
  gameOver: boolean;
  onSmiley: () => void;
  onRules: () => void;
  onFlagToggle: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  pendingDraw: Color | null;
  /** Online: false while my own offer is pending, so the answer buttons are hidden. */
  canAnswerDraw?: boolean;
}

export function InfoBar(props: InfoBarProps) {
  const { view, pendingDraw } = props;
  const low = view.turnsUntilReshuffle <= 2;
  return (
    <div className="infobar">
      <div className="infobar-top">
        <div className="infobar-cell">
          <Led value={view.mineCount} label="Mines" testId="mine-count" />
          <span className="led-caption">Mines</span>
        </div>
        <button
          type="button"
          className="smiley"
          aria-label="Smiley: restart"
          title="Restart"
          onClick={props.onSmiley}
        >
          <Px sprite={FACES[props.face]} className="smiley-face" />
        </button>
        <div className="infobar-cell">
          <Led
            value={view.turnsUntilReshuffle}
            label="Turns until the next reshuffle"
            testId="reshuffle-count"
            palette={low ? PALETTE : LED_AMBER}
            blink={low}
          />
          <span className="led-caption">Reshuffle</span>
        </div>
      </div>
      <div className="infobar-sides">
        <SidePanel color="w" view={view} cracking={props.crackColor === "w"} />
        <SidePanel color="b" view={view} cracking={props.crackColor === "b"} />
      </div>
      <div className="infobar-tools">
        <button
          type="button"
          className="btn tool-btn"
          aria-pressed={props.flagMode}
          aria-label={`Flag mode: ${props.flagMode ? "on" : "off"}`}
          onClick={() => {
            playCue("click");
            props.onFlagToggle();
          }}
        >
          <Px sprite={ICON_FLAG_MODE} className="tool-icon" />
          <span>Flag {props.flagMode ? "on" : "off"}</span>
        </button>
        <button
          type="button"
          className="btn tool-btn tool-help"
          aria-label="Rules"
          title="Rules"
          onClick={() => {
            playCue("click");
            props.onRules();
          }}
        >
          ?
        </button>
        <DrawOfferBar
          pendingDraw={pendingDraw}
          gameOver={props.gameOver}
          canAnswerDraw={props.canAnswerDraw}
          onAcceptDraw={props.onAcceptDraw}
          onDeclineDraw={props.onDeclineDraw}
        />
      </div>
    </div>
  );
}

/** The pending draw offer: a waiting note for the offerer, Accept and Decline for the other side. */
export function DrawOfferBar({
  pendingDraw,
  gameOver,
  canAnswerDraw,
  onAcceptDraw,
  onDeclineDraw,
}: {
  pendingDraw: Color | null;
  gameOver: boolean;
  canAnswerDraw?: boolean | undefined;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
}) {
  if (pendingDraw === null || gameOver) return null;
  if (canAnswerDraw === false) {
    return (
      <div className="draw-offer" role="status">
        <span>Draw offered. Waiting for an answer...</span>
      </div>
    );
  }
  return (
    <div className="draw-offer" role="alert">
      <span>
        {COLOR_NAME[pendingDraw]} offers a draw. {COLOR_NAME[opponent(pendingDraw)]}:
      </span>
      <button
        type="button"
        className="btn"
        onClick={() => {
          playCue("click");
          onAcceptDraw();
        }}
      >
        Accept draw
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          playCue("click");
          onDeclineDraw();
        }}
      >
        Decline draw
      </button>
    </div>
  );
}
