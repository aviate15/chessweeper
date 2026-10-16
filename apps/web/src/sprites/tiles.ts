import { overlay, recolor, ring } from "./build";
import type { Sprite } from "./types";

const hiddenLightShape: Sprite = [
  "LLLLLLLLLLLLLLLD",
  "LLLLLLLLLLLLLLDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LLSSSSSSSSSSSSDD",
  "LDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
];

export const TILE_HIDDEN_LIGHT: Sprite = hiddenLightShape;
/** Same bevel, cooler and darker: highlight b, fill a, shadow d. */
export const TILE_HIDDEN_DARK: Sprite = recolor(hiddenLightShape, { L: "b", S: "a", D: "d" });

export const TILE_REVEALED: Sprite = [
  "DDDDDDDDDDDDDDDD",
  ...Array.from({ length: 15 }, () => "DSSSSSSSSSSSSSSS"),
];

export const TILE_CRATER: Sprite = [
  "DDDDDDDDDDDDDDDD",
  "DSSSSSSSSSSSSSSS",
  "DSSSSSSSSSSSSSSS",
  "DSSSSSSDDDSSSSSS",
  "DSSSSDDZZZDDSSSS",
  "DSSSDZZKKKZZDSSS",
  "DSSDZKKKKKKKZDSS",
  "DSSDZKKKKKKKZDSS",
  "DSSDZKKKKKKKZDSS",
  "DSSSDZZKKKZZDSSS",
  "DSSSSDDZZZDDSSSS",
  "DSSSSSSDDDSSSSSS",
  "DSSSSSSSSSSSSSSS",
  "DSSSSSSSSSSSSSSS",
  "DSSSSSSSSSSSSSSS",
  "DSSSSSSSSSSSSSSS",
];

// Overlays (transparent centre).
export const OVERLAY_CHECK: Sprite = overlay(ring(16, 2, "F"), ring(12, 1, "M"), 2, 2);
export const OVERLAY_LAST_MOVE: Sprite = overlay(ring(16, 2, "Q"), ring(12, 1, "B"), 2, 2);
export const OVERLAY_SELECTED: Sprite = overlay(ring(16, 1, "K"), ring(14, 2, "Y"), 1, 1);
export const OVERLAY_LEGAL_DOT: Sprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "......KKKK......",
  ".....KHHHHK.....",
  ".....KHHHHK.....",
  ".....KHHHHK.....",
  ".....KHHHHK.....",
  "......KKKK......",
  "................",
  "................",
  "................",
  "................",
  "................",
];
