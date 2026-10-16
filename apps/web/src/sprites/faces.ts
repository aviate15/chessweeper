import { overlay } from "./build";
import type { Sprite } from "./types";

// Full widths of the top 12 rows of a 24x24 disc (bottom half mirrors).
const DISC_WIDTHS = [10, 14, 16, 18, 20, 20, 22, 22, 22, 24, 24, 24];
const SIZE = 24;

const inDisc = (x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  const row = y < 12 ? y : SIZE - 1 - y;
  const width = DISC_WIDTHS[row] ?? 0;
  const left = (SIZE - width) / 2;
  return x >= left && x < left + width;
};

const isOutline = (x: number, y: number): boolean =>
  inDisc(x, y) &&
  (!inDisc(x - 1, y) || !inDisc(x + 1, y) || !inDisc(x, y - 1) || !inDisc(x, y + 1));

const BASE_FACE: Sprite = Array.from({ length: SIZE }, (_, y) =>
  Array.from({ length: SIZE }, (_, x) => {
    if (!inDisc(x, y)) return ".";
    if (isOutline(x, y)) return "K";
    const shaded = (isOutline(x + 1, y) || isOutline(x, y + 1)) && x + y > SIZE;
    return shaded ? "y" : "Y";
  }).join(""),
);
const GLINT: Sprite = ["LL", "L."];
const FACE = overlay(BASE_FACE, GLINT, 5, 5);

const EYES: Sprite = ["KK....KK", "KK....KK", "KK....KK", "KK....KK"];
const SMILE: Sprite = ["K..........K", ".K........K.", "..KKKKKKKK.."];
const FROWN: Sprite = ["..KKKKKKKK..", ".K........K.", "K..........K"];
const OOH_EYES: Sprite = ["KKK....KKK", "KLK....KLK", "KKK....KKK"];
const OOH_MOUTH: Sprite = [".KK.", "KKKK", "KKKK", ".KK."];
const DEAD_EYE: Sprite = ["K...K", ".K.K.", "..K..", ".K.K.", "K...K"];
const SHADES: Sprite = [
  "..KKKKKKK..KKKKKKK..",
  "KKKKKKKKKKKKKKKKKKKK",
  "..KKLKKKK..KKLKKKK..",
  "..KKKKKKK..KKKKKKK..",
  "...KKKKK....KKKKK...",
  "....KKK......KKK....",
];

export const FACE_NORMAL: Sprite = overlay(overlay(FACE, EYES, 8, 7), SMILE, 6, 14);
export const FACE_OOH: Sprite = overlay(overlay(FACE, OOH_EYES, 7, 7), OOH_MOUTH, 10, 14);
export const FACE_DEAD: Sprite = overlay(
  overlay(overlay(FACE, DEAD_EYE, 6, 6), DEAD_EYE, 13, 6),
  FROWN,
  6,
  15,
);
export const FACE_COOL: Sprite = overlay(overlay(FACE, SHADES, 2, 6), SMILE, 6, 15);
