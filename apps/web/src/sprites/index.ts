import { FACE_COOL, FACE_DEAD, FACE_NORMAL, FACE_OOH } from "./faces";
import { LED_DIGITS, LED_KEYS } from "./led";
import { LED_AMBER, LED_GREEN } from "./palette";
import { PIECE_ORDER, PIECE_SPRITES } from "./pieces";
import {
  BADGE_SPRITES,
  EXPLOSION_FRAMES,
  FLAG,
  LIFE_CRACKED,
  LIFE_FULL,
  MINE,
  MINE_EXPLODED,
  NUMBER_SPRITES,
} from "./symbols";
import {
  OVERLAY_CHECK,
  OVERLAY_LAST_MOVE,
  OVERLAY_LEGAL_DOT,
  OVERLAY_SELECTED,
  TILE_CRATER,
  TILE_HIDDEN_DARK,
  TILE_HIDDEN_LIGHT,
  TILE_REVEALED,
} from "./tiles";
import type { SpriteEntry, SpriteGroup } from "./types";
import {
  BUTTON_PRESSED,
  BUTTON_UP,
  CLOSE_BOX,
  DIALOG_FRAME,
  DIALOG_SAMPLE,
  FAVICON,
  ICON_FLAG_MODE,
  ICON_FLIP,
  ICON_MOVES,
  ICON_SOUND_OFF,
  ICON_SOUND_ON,
  TITLE_BAR,
} from "./ui";

export * from "./palette";
export * from "./pieces";
export * from "./symbols";
export * from "./tiles";
export * from "./faces";
export * from "./led";
export * from "./ui";
export { spriteToSvg, spriteToSvgMarkup } from "./spriteToSvg";
export type { Palette, Sprite, SpriteEntry, SpriteGroup } from "./types";

const PIECE_NAMES = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };

/** Every sprite, grouped for the style-tile page and for tests. */
export const SPRITE_GROUPS: readonly SpriteGroup[] = [
  {
    id: "pieces",
    title: "Pieces",
    entries: (["w", "b"] as const).flatMap((side) =>
      PIECE_ORDER.map((kind): SpriteEntry => ({
        name: `${side === "w" ? "White" : "Black"} ${PIECE_NAMES[kind]}`,
        sprite: PIECE_SPRITES[`${side}${kind}`],
      })),
    ),
  },
  {
    id: "tiles",
    title: "Tile states",
    entries: [
      { name: "Hidden light", sprite: TILE_HIDDEN_LIGHT },
      { name: "Hidden dark", sprite: TILE_HIDDEN_DARK },
      { name: "Revealed", sprite: TILE_REVEALED },
      { name: "Crater", sprite: TILE_CRATER },
      { name: "Check", sprite: OVERLAY_CHECK },
      { name: "Last move", sprite: OVERLAY_LAST_MOVE },
      { name: "Selected", sprite: OVERLAY_SELECTED },
      { name: "Legal dot", sprite: OVERLAY_LEGAL_DOT },
    ],
  },
  {
    id: "numbers",
    title: "Numbers",
    entries: NUMBER_SPRITES.map((sprite, i) => ({ name: `Number ${String(i + 1)}`, sprite })),
  },
  {
    id: "badges",
    title: "Number badges",
    entries: BADGE_SPRITES.map((sprite, i) => ({ name: `Badge ${String(i + 1)}`, sprite })),
  },
  {
    id: "marks",
    title: "Flag, mine, explosion, lives",
    entries: [
      { name: "Flag", sprite: FLAG },
      { name: "Mine", sprite: MINE },
      { name: "Exploded mine", sprite: MINE_EXPLODED },
      ...EXPLOSION_FRAMES.map((sprite, i) => ({ name: `Explosion ${String(i + 1)}`, sprite })),
      { name: "Life full", sprite: LIFE_FULL },
      { name: "Life cracked", sprite: LIFE_CRACKED },
    ],
  },
  {
    id: "smileys",
    title: "Smileys",
    entries: [
      { name: "Normal", sprite: FACE_NORMAL },
      { name: "Ooh", sprite: FACE_OOH },
      { name: "Dead", sprite: FACE_DEAD },
      { name: "Sunglasses", sprite: FACE_COOL },
    ],
  },
  {
    id: "led",
    title: "LED digits",
    entries: LED_KEYS.map((key) => ({
      name: key === " " ? "LED blank" : key === "-" ? "LED minus" : `LED ${key}`,
      sprite: LED_DIGITS[key] ?? [],
    })),
  },
  {
    id: "led-variants",
    title: "LED colour variants",
    entries: [
      { name: "LED green 8", sprite: LED_DIGITS["8"] ?? [], palette: LED_GREEN },
      { name: "LED amber 8", sprite: LED_DIGITS["8"] ?? [], palette: LED_AMBER },
    ],
  },
  {
    id: "buttons",
    title: "Buttons",
    entries: [
      { name: "Button up", sprite: BUTTON_UP },
      { name: "Button pressed", sprite: BUTTON_PRESSED },
    ],
  },
  {
    id: "dialog",
    title: "Dialog chrome",
    entries: [
      { name: "Title bar", sprite: TITLE_BAR },
      { name: "Close box", sprite: CLOSE_BOX },
      { name: "Frame", sprite: DIALOG_FRAME },
      { name: "Sample dialog", sprite: DIALOG_SAMPLE },
    ],
  },
  {
    id: "icons",
    title: "Icons",
    entries: [
      { name: "Flag mode", sprite: ICON_FLAG_MODE },
      { name: "Sound on", sprite: ICON_SOUND_ON },
      { name: "Sound off", sprite: ICON_SOUND_OFF },
      { name: "Flip board", sprite: ICON_FLIP },
      { name: "Moves", sprite: ICON_MOVES },
      { name: "Favicon", sprite: FAVICON },
    ],
  },
];
