import type { Sprite } from "./types";

export const LED_W = 13;
export const LED_H = 23;

// Seven segments, each a hand-drawn bitmap box: [x, y, rows].
type Segment = readonly [number, number, readonly string[]];
const H: readonly string[] = ["...#######...", "..#########..", "...#######..."].map((r) =>
  r.slice(0, 13),
);
const V: readonly string[] = Array.from({ length: 7 }, () => "###");

const SEG: Readonly<Record<"a" | "b" | "c" | "d" | "e" | "f" | "g", Segment>> = {
  a: [0, 0, H],
  g: [0, 10, H],
  d: [0, 20, H],
  f: [0, 3, V],
  b: [10, 3, V],
  e: [0, 13, V],
  c: [10, 13, V],
};

const LIT: Readonly<Record<string, string>> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

function digit(lit: string, blank = false): Sprite {
  const grid = Array.from({ length: LED_H }, () => Array.from({ length: LED_W }, () => "k"));
  if (!blank) {
    for (const [name, [sx, sy, rows]] of Object.entries(SEG)) {
      const on = lit.includes(name);
      rows.forEach((row, dy) => {
        row.split("").forEach((c, dx) => {
          const line = grid[sy + dy];
          if (c === "#" && line) line[sx + dx] = on ? "r" : "n";
        });
      });
    }
  }
  return grid.map((r) => r.join(""));
}

export const LED_DIGITS: Readonly<Record<string, Sprite>> = Object.fromEntries([
  ...Object.entries(LIT)
    .filter(([key]) => key !== " ")
    .map(([key, lit]) => [key, digit(lit)] as const),
  [" ", digit("", true)],
]);

export const LED_KEYS: readonly string[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "-",
  " ",
];
