import type { Sprite } from "./types";

/** Swap palette keys in a sprite (used to colour one hand-drawn shape two ways). */
export const recolor = (s: Sprite, map: Readonly<Record<string, string>>): Sprite =>
  s.map((row) => [...row].map((c) => map[c] ?? c).join(""));

export const solid = (w: number, h: number, ch: string): Sprite =>
  Array.from({ length: h }, () => ch.repeat(w));

/** Draw `top` over `base` at (x, y); "." in `top` is transparent. */
export function overlay(base: Sprite, top: Sprite, x = 0, y = 0): Sprite {
  const rows = base.map((r) => [...r]);
  top.forEach((trow, ty) => {
    const row = rows[y + ty];
    if (!row) throw new Error("overlay out of bounds (y)");
    [...trow].forEach((c, tx) => {
      if (c === ".") return;
      if (x + tx >= row.length) throw new Error("overlay out of bounds (x)");
      row[x + tx] = c;
    });
  });
  return rows.map((r) => r.join(""));
}

/** Two-ring bevelled rectangle. Ring 0 is the outer ring, ring 1 the inner. */
export function bevel(
  w: number,
  h: number,
  fill: string,
  rings: readonly [readonly [string, string], readonly [string, string]],
): Sprite {
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      const r = rings[d];
      if (!r) return fill;
      const topLeft = (y === d && x < w - 1 - d) || (x === d && y < h - 1 - d);
      return topLeft ? r[0] : r[1];
    }).join(""),
  );
}

/** Square ring of `thickness` px with a transparent centre. */
export function ring(size: number, thickness: number, ch: string): Sprite {
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      Math.min(x, y, size - 1 - x, size - 1 - y) < thickness ? ch : ".",
    ).join(""),
  );
}
