import { bevel, overlay, solid } from "./build";
import { PIECE_SPRITES } from "./pieces";
import { FLAG, MINE } from "./symbols";
import type { Sprite } from "./types";

// ---- Buttons (48x20; the label is HTML text laid on top) ----
export const BUTTON_UP: Sprite = bevel(48, 20, "S", [
  ["L", "K"],
  ["S", "D"],
]);
export const BUTTON_PRESSED: Sprite = bevel(48, 20, "S", [
  ["K", "K"],
  ["D", "D"],
]);

// ---- Dialog chrome ----
const CLOSE_X: Sprite = ["KK..KK", ".KKKK.", "..KK..", ".KKKK.", "KK..KK"];
export const CLOSE_BOX: Sprite = overlay(
  bevel(14, 12, "S", [
    ["L", "K"],
    ["S", "D"],
  ]),
  CLOSE_X,
  4,
  3,
);

const TITLE_W = 114;
export const TITLE_BAR: Sprite = Array.from(
  { length: 14 },
  () => "N".repeat(40) + "j".repeat(38) + "B".repeat(TITLE_W - 78),
);

export const DIALOG_FRAME: Sprite = bevel(120, 80, "S", [
  ["S", "K"],
  ["L", "D"],
]);

const TEXT_BAR: Sprite = solid(48, 2, "K");
const TEXT_BAR_SHORT: Sprite = solid(34, 2, "K");

const SAMPLE_BUTTON = overlay(BUTTON_UP, solid(8, 2, "K"), 20, 9);

export const DIALOG_SAMPLE: Sprite = overlay(
  overlay(
    overlay(
      overlay(overlay(overlay(DIALOG_FRAME, TITLE_BAR, 3, 3), CLOSE_BOX, 103, 4), MINE, 8, 24),
      TEXT_BAR,
      30,
      28,
    ),
    TEXT_BAR_SHORT,
    30,
    36,
  ),
  SAMPLE_BUTTON,
  36,
  54,
);

// ---- Icons (16x16) ----
export const ICON_FLAG_MODE: Sprite = overlay(
  FLAG,
  ["..Y..", "YYYYY", "..Y..", ".....", "....."],
  10,
  1,
);

const SPEAKER = [
  "................",
  "................",
  ".......K........",
  "......KK........",
  ".....KKK........",
  "..KKKKKK........",
  "..KKKKKK........",
  "..KKKKKK........",
  "..KKKKKK........",
  "..KKKKKK........",
  ".....KKK........",
  "......KK........",
  ".......K........",
  "................",
  "................",
  "................",
];
export const ICON_SOUND_ON: Sprite = overlay(
  SPEAKER,
  [
    "....K...",
    ".....K..",
    "..K..K..",
    "...K..K.",
    "...K..K.",
    "..K..K..",
    ".....K..",
    "....K...",
  ].map((r) => r),
  8,
  3,
);
export const ICON_SOUND_OFF: Sprite = overlay(
  SPEAKER,
  ["F...F", ".F.F.", "..F..", ".F.F.", "F...F"],
  10,
  5,
);

export const ICON_FLIP: Sprite = [
  "................",
  "................",
  "....U...........",
  "...UUU.....F....",
  "..UUUUU....F....",
  "....U......F....",
  "....U......F....",
  "....U......F....",
  "....U......F....",
  "....U......F....",
  "....U....FFFFF..",
  "....U.....FFF...",
  "....U......F....",
  "................",
  "................",
  "................",
];

export const ICON_MOVES: Sprite = [
  "................",
  "..KKKKKKKKKKKK..",
  "..KLLLLLLLLLLK..",
  "..KLFFLKKKKKLK..",
  "..KLLLLLLLLLLK..",
  "..KLFFLKKKKKLK..",
  "..KLLLLLLLLLLK..",
  "..KLFFLKKKKKLK..",
  "..KLLLLLLLLLLK..",
  "..KLFFLKKKKKLK..",
  "..KLLLLLLLLLLK..",
  "..KKKKKKKKKKKK..",
  "................",
  "................",
  "................",
  "................",
];

// ---- Favicon: knight with a mine ----
const TINY_MINE: Sprite = [
  "...K...",
  ".K.K.K.",
  "..KKK..",
  "KKKLKKK",
  "..KKK..",
  ".K.K.K.",
  "...K...",
];
export const FAVICON: Sprite = overlay(
  overlay(solid(16, 16, "T"), PIECE_SPRITES.wn),
  TINY_MINE,
  9,
  9,
);
