import type { Palette } from "./types";

/** Colour map for every sprite. "." is reserved for transparent. Mirrored in theme.css as --px-*. */
export const PALETTE: Palette = {
  // Windows chrome
  K: "#000000",
  L: "#FFFFFF",
  S: "#C0C0C0",
  D: "#808080",
  Z: "#404040",
  // Dark hidden tile (teal-slate): fill, highlight, shadow
  a: "#7F9AA0",
  b: "#B4CCD0",
  d: "#3F5A60",
  // Classic Minesweeper number colours
  "1": "#0000FF",
  "2": "#008000",
  "3": "#FF0000",
  "4": "#000080",
  "5": "#800000",
  "6": "#008080",
  "7": "#000000",
  "8": "#808080",
  // Accents
  F: "#FF0000",
  M: "#800000",
  O: "#FF8000",
  Y: "#FFFF00",
  y: "#C0A000",
  T: "#008080",
  N: "#000080",
  U: "#0000FF",
  H: "#00A000",
  Q: "#5FA8FF",
  B: "#1084D0",
  j: "#0840A8",
  // White pieces: ivory with gold trim
  W: "#F5EBC8",
  V: "#FFFFF0",
  w: "#CDBF8F",
  G: "#D9A21B",
  // Black pieces: charcoal with crimson trim
  C: "#3B3B46",
  c: "#646474",
  x: "#22222A",
  R: "#D81E3C",
  // LED: lit, dim, background
  r: "#FF2020",
  n: "#3A0000",
  k: "#000000",
};

export const LED_GREEN: Palette = { ...PALETTE, r: "#20FF40", n: "#003A0A" };
export const LED_AMBER: Palette = { ...PALETTE, r: "#FFB000", n: "#3A2800" };

/** Named palette groups for the swatch table. */
export const SWATCH_GROUPS: readonly { title: string; keys: readonly string[] }[] = [
  { title: "Window", keys: ["K", "L", "S", "D", "Z"] },
  { title: "Dark tile", keys: ["a", "b", "d"] },
  { title: "Numbers", keys: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { title: "Accents", keys: ["F", "M", "O", "Y", "y", "T", "N", "U", "H", "Q", "B", "j"] },
  { title: "White pieces", keys: ["W", "V", "w", "G"] },
  { title: "Black pieces", keys: ["C", "c", "x", "R"] },
  { title: "LED (red)", keys: ["r", "n", "k"] },
];
