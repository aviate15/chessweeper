import { useEffect, useRef, useState, type ReactNode } from "react";
import { playCue } from "../audio";
import { ICON_FLIP, ICON_MOVES, ICON_SOUND_OFF, ICON_SOUND_ON, type Sprite } from "../sprites";
import { Px } from "./Px";

const CHECK: Sprite = ["......KK", ".....KK.", "K...KK..", "KK.KK...", ".KKK....", "..K....."];

export interface MenuBarProps {
  gameOver: boolean;
  canOfferDraw: boolean;
  flip: boolean;
  soundOn: boolean;
  onNewGame: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onToggleFlip: () => void;
  onToggleSound: () => void;
  onMoves: () => void;
}

function Item({
  role = "menuitem",
  checked,
  icon,
  disabled,
  onSelect,
  children,
}: {
  role?: "menuitem" | "menuitemcheckbox";
  checked?: boolean;
  icon?: Sprite;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "menuitemcheckbox" ? Boolean(checked) : undefined}
      disabled={disabled}
      className="menu-item"
      onClick={onSelect}
    >
      <span className="menu-mark">
        {checked ? <Px sprite={CHECK} className="menu-check" /> : null}
      </span>
      <span className="menu-icon">
        {icon ? <Px sprite={icon} className="menu-icon-px" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

/** Windows-style menu bar with one "Game" dropdown. */
export function MenuBar(props: MenuBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick =
    (action: () => void, close = true) =>
    () => {
      playCue("click");
      action();
      if (close) setOpen(false);
    };

  return (
    <nav className="menubar" aria-label="Game menu" ref={rootRef}>
      <button
        type="button"
        className={open ? "menubar-title menubar-open" : "menubar-title"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          playCue("click");
          setOpen((v) => !v);
        }}
      >
        Game
      </button>
      {open && (
        <div className="menu-drop" role="menu" aria-label="Game">
          <Item onSelect={pick(props.onNewGame)}>New game</Item>
          <Item disabled={props.gameOver} onSelect={pick(props.onResign)}>
            Resign
          </Item>
          <Item disabled={props.gameOver || !props.canOfferDraw} onSelect={pick(props.onOfferDraw)}>
            Offer draw
          </Item>
          <div className="menu-sep" role="separator" />
          <Item
            role="menuitemcheckbox"
            checked={props.flip}
            icon={ICON_FLIP}
            onSelect={pick(props.onToggleFlip, false)}
          >
            Flip board
          </Item>
          <Item
            role="menuitemcheckbox"
            checked={props.soundOn}
            icon={props.soundOn ? ICON_SOUND_ON : ICON_SOUND_OFF}
            onSelect={pick(props.onToggleSound, false)}
          >
            Sound
          </Item>
          <Item icon={ICON_MOVES} onSelect={pick(props.onMoves)}>
            Moves
          </Item>
        </div>
      )}
    </nav>
  );
}
