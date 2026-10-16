import { overlay, recolor, solid } from "./build";
import type { Sprite } from "./types";

// 8x11 bold digit glyphs, "#" = ink. Placed on a transparent 16x16 at (4, 2).
const GLYPHS: readonly (readonly string[])[] = [
  [
    "...##...",
    "..###...",
    ".####...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    ".######.",
    ".######.",
  ],
  [
    ".######.",
    "##....##",
    "......##",
    ".....##.",
    "....##..",
    "...##...",
    "..##....",
    ".##.....",
    "##......",
    "########",
    "########",
  ],
  [
    ".######.",
    "##....##",
    "......##",
    "......##",
    "..#####.",
    "..#####.",
    "......##",
    "......##",
    "##....##",
    "##....##",
    ".######.",
  ],
  [
    "....###.",
    "...####.",
    "..##.##.",
    ".##..##.",
    "##...##.",
    "########",
    "########",
    ".....##.",
    ".....##.",
    ".....##.",
    ".....##.",
  ],
  [
    "########",
    "########",
    "##......",
    "##......",
    "#######.",
    "##....##",
    "......##",
    "......##",
    "......##",
    "##....##",
    ".######.",
  ],
  [
    "..#####.",
    ".##.....",
    "##......",
    "##......",
    "#######.",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    ".######.",
  ],
  [
    "########",
    "########",
    "......##",
    ".....##.",
    "....##..",
    "...##...",
    "...##...",
    "..##....",
    "..##....",
    "..##....",
    "..##....",
  ],
  [
    ".######.",
    "##....##",
    "##....##",
    "##....##",
    ".######.",
    ".######.",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    ".######.",
  ],
];

const blank16: Sprite = solid(16, 16, ".");

/** NUMBER_SPRITES[0] is "1" ... NUMBER_SPRITES[7] is "8". Transparent, drawn over a revealed tile. */
export const NUMBER_SPRITES: readonly Sprite[] = GLYPHS.map((glyph, i) =>
  overlay(blank16, recolor(glyph, { "#": String(i + 1) }), 4, 2),
);

// 3x5 digit glyphs for the number badge (a piece stands on the numbered square).
const BADGE_GLYPHS: readonly (readonly string[])[] = [
  [".#.", "##.", ".#.", ".#.", "###"],
  ["##.", "..#", ".#.", "#..", "###"],
  ["##.", "..#", ".#.", "..#", "##."],
  ["#.#", "#.#", "###", "..#", "..#"],
  ["###", "#..", "##.", "..#", "##."],
  [".##", "#..", "###", "#.#", "###"],
  ["###", "..#", ".#.", ".#.", ".#."],
  ["###", "#.#", "###", "#.#", "###"],
];

const BADGE_BOX: Sprite = [
  "KKKKKKK",
  "KVVVVVK",
  "KVVVVVK",
  "KVVVVVK",
  "KVVVVVK",
  "KVVVVVK",
  "KVVVVVK",
  "KVVVVVK",
  "KKKKKKK",
];

/**
 * BADGE_SPRITES[0] is "1" ... [7] is "8": a 7x9 off-white box with a 1px black outline in the
 * bottom-right corner of a transparent 16x16, holding the classic-coloured digit. Used when a
 * piece stands on the numbered square, so every colour stays readable.
 */
export const BADGE_SPRITES: readonly Sprite[] = BADGE_GLYPHS.map((glyph, i) =>
  overlay(
    overlay(blank16, BADGE_BOX, 9, 7),
    recolor(glyph, { "#": String(i + 1), ".": "V" }),
    11,
    9,
  ),
);

export const FLAG: Sprite = [
  "................",
  "................",
  "....FFFFK.......",
  "...LFFFFK.......",
  "..FFFFFFK.......",
  "...FFFFFK.......",
  "....FFFFK.......",
  "........K.......",
  "........K.......",
  "........K.......",
  ".......KKK......",
  "......KKKKK.....",
  ".....KKKKKKK....",
  ".....KKKKKKK....",
  "................",
  "................",
];

export const MINE: Sprite = [
  "................",
  ".......KK.......",
  "...K...KK...K...",
  "....K.KKKK.K....",
  ".....KKKKKK.....",
  "..K.KKLLKKKK.K..",
  "...KKLLKKKKKK...",
  ".KKKKLKKKKKKKKK.",
  "...KKKKKKKKKK...",
  "..K.KKKKKKKK.K..",
  ".....KKKKKK.....",
  "....K.KKKK.K....",
  "...K...KK...K...",
  ".......KK.......",
  "................",
  "................",
];

/** Windows-style: the mine that killed you sits on a red field. */
export const MINE_EXPLODED: Sprite = overlay(solid(16, 16, "F"), MINE);

export const EXPLOSION_FRAMES: readonly Sprite[] = [
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    ".......OO.......",
    "......OYYO......",
    ".....OYLLYO.....",
    ".....OYLLYO.....",
    "......OYYO......",
    ".......OO.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    ".......OO.......",
    "...O...OO...O...",
    "....O.OYYO.O....",
    ".....OYYYYO.....",
    "..OOYYLLLLYYOO..",
    ".OYYYLLLLLLYYYO.",
    ".OYYYLLLLLLYYYO.",
    "..OOYYLLLLYYOO..",
    ".....OYYYYO.....",
    "....O.OYYO.O....",
    "...O...OO...O...",
    ".......OO.......",
    "................",
    "................",
  ],
  [
    ".......FF.......",
    "..F....FF....F..",
    "...F..FOOF..F...",
    "....FFOYYOFF....",
    ".F...OYYYYO...F.",
    "..FFOYYLLYYOFF..",
    "...OYYLLLLYYO...",
    "FFOYYLLLLLLYYOFF",
    "FFOYYLLLLLLYYOFF",
    "...OYYLLLLYYO...",
    "..FFOYYLLYYOFF..",
    ".F...OYYYYO...F.",
    "....FFOYYOFF....",
    "...F..FOOF..F...",
    "..F....FF....F..",
    ".......FF.......",
  ],
  [
    "................",
    "...D.....D......",
    "......D....D....",
    "..D..SS..SS..D..",
    "....SDDSSDDS....",
    ".D..DSSSSSSD.D..",
    "...SDSSDDSSDS...",
    "..DSSDDSSDDSSD..",
    "..DSSDDSSDDSSD..",
    "...SDSSDDSSDS...",
    ".D..DSSSSSSD.D..",
    "....SDDSSDDS....",
    "..D..SS..SS..D..",
    "......D....D....",
    "...D.....D......",
    "................",
  ],
];

/** A tiny gold crown: one king life. */
const CROWN: Sprite = [
  "................",
  "................",
  "................",
  "..K....KK....K..",
  ".KYK..KYYK..KYK.",
  ".KYYK.KYYK.KYYK.",
  ".KYYYKKYYKKYYYK.",
  ".KYLYYYYYYYYYYK.",
  ".KYLYYYYYYYYYyK.",
  ".KYYYYFYYFYYYyK.",
  ".KyYYYYYYYYYyyK.",
  ".KyyyyyyyyyyyyK.",
  ".KKKKKKKKKKKKKK.",
  "................",
  "................",
  "................",
];

export const LIFE_FULL: Sprite = CROWN;
const crack: Sprite = [
  "................",
  "................",
  "................",
  "................",
  "........K.......",
  ".......K........",
  "........KK......",
  ".......KK.......",
  "........K.......",
  ".......K........",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];
/** Grey, with a crack: a spent king life. */
export const LIFE_CRACKED: Sprite = overlay(
  recolor(CROWN, { Y: "D", y: "Z", L: "S", F: "Z" }),
  crack,
);
