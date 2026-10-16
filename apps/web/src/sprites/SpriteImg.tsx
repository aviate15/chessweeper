import type { CSSProperties } from "react";
import { PALETTE } from "./palette";
import { spriteToSvg } from "./spriteToSvg";
import type { Palette, Sprite } from "./types";

interface SpriteImgProps {
  readonly sprite: Sprite;
  readonly palette?: Palette | undefined;
  /** Integer pixel scale only. */
  readonly scale?: number;
  readonly label?: string;
  readonly style?: CSSProperties;
}

export function SpriteImg({
  sprite,
  palette = PALETTE,
  scale = 1,
  label = "",
  style,
}: SpriteImgProps) {
  const width = (sprite[0]?.length ?? 0) * scale;
  const height = sprite.length * scale;
  return (
    <img
      src={spriteToSvg(sprite, palette)}
      alt={label}
      width={width}
      height={height}
      draggable={false}
      style={{ imageRendering: "pixelated", display: "block", ...style }}
    />
  );
}

/** Several same-size sprites stacked in one cell (tile, then overlays, then piece). */
export function SpriteStack({
  layers,
  scale = 1,
  label = "",
}: {
  readonly layers: readonly Sprite[];
  readonly scale?: number;
  readonly label?: string;
}) {
  const first = layers[0];
  const width = (first?.[0]?.length ?? 0) * scale;
  const height = (first?.length ?? 0) * scale;
  return (
    <span
      role="img"
      aria-label={label}
      style={{ position: "relative", display: "inline-block", width, height }}
    >
      {layers.map((layer, i) => (
        <SpriteImg
          key={i}
          sprite={layer}
          scale={scale}
          style={{ position: "absolute", left: 0, top: 0 }}
        />
      ))}
    </span>
  );
}
