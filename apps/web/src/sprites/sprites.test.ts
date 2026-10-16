import { describe, expect, it } from "vitest";
import { PALETTE, SPRITE_GROUPS, spriteToSvg, spriteToSvgMarkup } from "./index";

const SIZES: Record<string, [number, number]> = {
  pieces: [16, 16],
  tiles: [16, 16],
  numbers: [16, 16],
  badges: [16, 16],
  marks: [16, 16],
  smileys: [24, 24],
  led: [13, 23],
  "led-variants": [13, 23],
  icons: [16, 16],
};

describe("sprites", () => {
  for (const group of SPRITE_GROUPS) {
    for (const entry of group.entries) {
      it(`${entry.name} is rectangular and uses only palette keys`, () => {
        const palette = entry.palette ?? PALETTE;
        expect(entry.sprite.length).toBeGreaterThan(0);
        const width = entry.sprite[0]?.length ?? 0;
        for (const row of entry.sprite) {
          expect(row.length).toBe(width);
          for (const ch of row) {
            if (ch !== ".") expect(palette[ch], `key "${ch}"`).toBeDefined();
          }
        }
        const expected = SIZES[group.id];
        if (expected) expect([width, entry.sprite.length]).toEqual(expected);
        expect(() => spriteToSvg(entry.sprite, palette)).not.toThrow();
      });
    }
  }
});

describe("spriteToSvg", () => {
  it("merges horizontal runs and skips transparent pixels", () => {
    const svg = spriteToSvgMarkup(["KK.L", "..LL"], PALETTE);
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2" viewBox="0 0 4 2" shape-rendering="crispEdges">' +
        '<rect x="0" y="0" width="2" height="1" fill="#000000"/>' +
        '<rect x="3" y="0" width="1" height="1" fill="#FFFFFF"/>' +
        '<rect x="2" y="1" width="2" height="1" fill="#FFFFFF"/>' +
        "</svg>",
    );
  });

  it("returns a cached data URI", () => {
    const sprite = ["KL"];
    const a = spriteToSvg(sprite, PALETTE);
    expect(a.startsWith("data:image/svg+xml,")).toBe(true);
    expect(spriteToSvg(sprite, PALETTE)).toBe(a);
  });

  it("rejects unknown keys and ragged rows", () => {
    expect(() => spriteToSvgMarkup(["?"], PALETTE)).toThrow(/Unknown palette key/);
    expect(() => spriteToSvgMarkup(["KK", "K"], PALETTE)).toThrow(/length/);
  });
});
