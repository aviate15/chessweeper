import { recolor } from "./build";
import type { Sprite } from "./types";

// Shapes are drawn once with generic keys, then coloured per side:
//   o outline, f fill, h highlight, s shade, t trim.
const pawn: Sprite = [
  "................",
  "................",
  "......oooo......",
  ".....ohffso.....",
  ".....offffo.....",
  ".....offfso.....",
  "......oooo......",
  "....oottttoo....",
  ".....ohffso.....",
  ".....offfso.....",
  "....ohffffso....",
  "...ohffffffso...",
  "...offffffffo...",
  "..oottttttttoo..",
  "..oooooooooooo..",
  "................",
];

const rook: Sprite = [
  "................",
  "................",
  ".oooo.oooo.oooo.",
  ".ohfo.ohfo.ohfo.",
  ".offo.offo.offo.",
  ".oooooooooooooo.",
  "..ohffffffffso..",
  "...offffffffo...",
  "...ohffffffso...",
  "...offffffffo...",
  "...offffffffo...",
  "..ohffffffffso..",
  ".ohffffffffffso.",
  ".oottttttttttoo.",
  ".oooooooooooooo.",
  "................",
];

const knight: Sprite = [
  "................",
  "......o..o......",
  ".....ohooho.....",
  "....ohfffffo....",
  "...ohfffffffo...",
  "..ohfoffffffso..",
  ".ohfffffffffffo.",
  "ohfffffffffffso.",
  "ohffffooffffffo.",
  ".oooohffffffso..",
  "....ohfffffffo..",
  "...ohffffffffso.",
  "...offffffffffo.",
  "..oottttttttttoo",
  "..oooooooooooooo",
  "................",
];

const bishop: Sprite = [
  ".......oo.......",
  "......ohfo......",
  ".....ohffso.....",
  "....ohffofso....",
  "....offoofso....",
  "....offfofso....",
  "....ohfffsso....",
  ".....offfso.....",
  "......oooo......",
  "...oottttttoo...",
  ".....ohffso.....",
  "....ohffffso....",
  "...ohffffffso...",
  "..oottttttttoo..",
  "..oooooooooooo..",
  "................",
];

const queen: Sprite = [
  ".o..o..oo..o..o.",
  ".oo.oo.oo.oo.oo.",
  "..ohfoohfoofso..",
  ".ohffffffffffso.",
  "...ohffffffso...",
  "....offffffo....",
  ".....ohffso.....",
  ".....offfso.....",
  "....oottttoo....",
  ".....ohffso.....",
  "....ohffffso....",
  "...ohffffffso...",
  "...offffffffo...",
  "..oottttttttoo..",
  "..oooooooooooo..",
  "................",
];

const king: Sprite = [
  ".......oo.......",
  "......otto......",
  "....oottttoo....",
  "......otto......",
  "...ooohffsooo...",
  "..ohffffffffso..",
  "..offfffffffso..",
  "...ohffffffso...",
  "....offffffo....",
  "....oottttoo....",
  ".....ohffso.....",
  "....ohffffso....",
  "...ohffffffso...",
  "..oottttttttoo..",
  "..oooooooooooo..",
  "................",
];

const WHITE = { o: "K", f: "W", h: "V", s: "w", t: "G" };
const BLACK = { o: "K", f: "C", h: "c", s: "x", t: "R" };

const shapes = { k: king, q: queen, r: rook, b: bishop, n: knight, p: pawn } as const;

type Kind = keyof typeof shapes;
export type PieceCode = `${"w" | "b"}${Kind}`;

const build = (): Record<PieceCode, Sprite> => {
  const out: Partial<Record<PieceCode, Sprite>> = {};
  for (const kind of Object.keys(shapes) as Kind[]) {
    out[`w${kind}`] = recolor(shapes[kind], WHITE);
    out[`b${kind}`] = recolor(shapes[kind], BLACK);
  }
  return out as Record<PieceCode, Sprite>;
};

export const PIECE_SPRITES: Readonly<Record<PieceCode, Sprite>> = build();
export const PIECE_ORDER: readonly Kind[] = ["k", "q", "r", "b", "n", "p"];
