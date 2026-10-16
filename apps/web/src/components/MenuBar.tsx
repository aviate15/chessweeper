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
  onOptions: () => void;
  onRules: () => void;
  /** Online play: New game becomes Leave game, and Flip board and Options are disabled. */
  online?: boolean;
  /** False when this build has no server URL, so Online... is greyed out. */
  onlineAvailable?: boolean;
  onOnline?: () => void;
  onLeave?: () => void;
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

type MenuName = "game" | "help";

/** Windows-style menu bar with "Game" and "Help" dropdowns. */
export function MenuBar(props: MenuBarProps) {
  const [menu, setMenu] = useState<MenuName | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menu === null) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const pick =
    (action: () => void, close = true) =>
    () => {
      playCue("click");
      action();
      if (close) setMenu(null);
    };

  const title = (name: MenuName, text: string) => (
    <button
      type="button"
      className={menu === name ? "menubar-title menubar-open" : "menubar-title"}
      aria-haspopup="menu"
      aria-expanded={menu === name}
      onClick={() => {
        playCue("click");
        setMenu((v) => (v === name ? null : name));
      }}
    >
      {text}
    </button>
  );

  return (
    <nav className="menubar" aria-label="Menu" ref={rootRef}>
      <div className="menu-root">
        {title("game", "Game")}
        {menu === "game" && (
          <div className="menu-drop" role="menu" aria-label="Game">
            {props.online ? (
              <Item onSelect={pick(props.onLeave ?? props.onNewGame)}>Leave game</Item>
            ) : (
              <>
                <Item onSelect={pick(props.onNewGame)}>New game</Item>
                <Item
                  disabled={props.onlineAvailable === false || !props.onOnline}
                  onSelect={pick(props.onOnline ?? props.onNewGame)}
                >
                  Online...
                </Item>
              </>
            )}
            <Item disabled={props.gameOver} onSelect={pick(props.onResign)}>
              Resign
            </Item>
            <Item
              disabled={props.gameOver || !props.canOfferDraw}
              onSelect={pick(props.onOfferDraw)}
            >
              Offer draw
            </Item>
            <div className="menu-sep" role="separator" />
            <Item
              role="menuitemcheckbox"
              checked={props.flip}
              disabled={props.online === true}
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
            <div className="menu-sep" role="separator" />
            <Item disabled={props.online === true} onSelect={pick(props.onOptions)}>
              Options...
            </Item>
          </div>
        )}
      </div>
      <div className="menu-root">
        {title("help", "Help")}
        {menu === "help" && (
          <div className="menu-drop" role="menu" aria-label="Help">
            <Item onSelect={pick(props.onRules)}>Rules</Item>
          </div>
        )}
      </div>
    </nav>
  );
}
