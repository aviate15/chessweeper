import type { CSSProperties, ReactNode } from "react";
import { PALETTE, spriteToSvg, type Palette, type Sprite } from "../sprites";

/** CSS `url(...)` for a sprite (cached by spriteToSvg). */
export function spriteUrl(sprite: Sprite, palette: Palette = PALETTE): string {
  return `url("${spriteToSvg(sprite, palette)}")`;
}

interface PxProps {
  sprite: Sprite;
  palette?: Palette | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}

/**
 * A sprite drawn as a CSS background that fills its box (box sizes are whole multiples of the
 * sprite, set in theme.css). Cheaper than an <img> per layer and easy to animate.
 */
export function Px({ sprite, palette, className, style, children }: PxProps) {
  return (
    <span
      className={className ? `px ${className}` : "px"}
      style={{ backgroundImage: spriteUrl(sprite, palette ?? PALETTE), ...style }}
      aria-hidden={children === undefined ? true : undefined}
    >
      {children}
    </span>
  );
}
