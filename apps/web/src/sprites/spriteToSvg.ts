import type { Palette, Sprite } from "./types";

/** Pure: sprite rows to SVG markup. Same-colour horizontal runs merge into one <rect>. */
export function spriteToSvgMarkup(sprite: Sprite, palette: Palette): string {
  const height = sprite.length;
  const width = sprite[0]?.length ?? 0;
  let rects = "";
  sprite.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `Row ${String(y)} has length ${String(row.length)}, expected ${String(width)}`,
      );
    }
    let x = 0;
    while (x < width) {
      const key = row.charAt(x);
      let end = x + 1;
      while (end < width && row.charAt(end) === key) end++;
      if (key !== ".") {
        const fill = palette[key];
        if (fill === undefined) throw new Error(`Unknown palette key "${key}" at row ${String(y)}`);
        rects += `<rect x="${String(x)}" y="${String(y)}" width="${String(end - x)}" height="1" fill="${fill}"/>`;
      }
      x = end;
    }
  });
  const w = String(width);
  const h = String(height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

const cache = new WeakMap<Sprite, WeakMap<Palette, string>>();

/** Cached data URI for use as <img src> or a CSS background. */
export function spriteToSvg(sprite: Sprite, palette: Palette): string {
  let byPalette = cache.get(sprite);
  if (!byPalette) {
    byPalette = new WeakMap();
    cache.set(sprite, byPalette);
  }
  let uri = byPalette.get(palette);
  if (uri === undefined) {
    uri = `data:image/svg+xml,${encodeURIComponent(spriteToSvgMarkup(sprite, palette))}`;
    byPalette.set(palette, uri);
  }
  return uri;
}
