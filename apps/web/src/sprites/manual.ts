import { overlay, recolor } from "./build";
import { MINE } from "./symbols";
import type { Sprite } from "./types";

/** Manual mine mode (3.10): a mine drawn in its placer's colour (White gold, Black crimson). */
export const MINE_WHITE: Sprite = recolor(MINE, { K: "y" });
export const MINE_BLACK: Sprite = recolor(MINE, { K: "R" });

// A 7x9 outlined box, bottom-right, holding a "2": marks a big mine (both players placed it).
const BIG_BADGE_BOX: Sprite = [
  "KKKKKKK",
  "KYYYYYK",
  "KYYYYYK",
  "KYYYYYK",
  "KYYYYYK",
  "KYYYYYK",
  "KYYYYYK",
  "KYYYYYK",
  "KKKKKKK",
];
const BIG_BADGE_TWO: Sprite = ["KKK", "..K", "KKK", "K..", "KKK"];

/** A big mine: a maroon mine with a yellow "2" badge. */
export const MINE_BIG: Sprite = overlay(
  overlay(recolor(MINE, { K: "M" }), BIG_BADGE_BOX, 9, 7),
  BIG_BADGE_TWO,
  10,
  10,
);
