import { useEffect, useState } from "react";

/**
 * Logical (unscaled) window size in CSS px, side-by-side layout: 6 frame + 8 body padding +
 * 264 board (with rank gutter) + 4 gap + 104 move log wide; 446 tall.
 */
export const WINDOW_W = 386;
export const WINDOW_H = 446;
/** Logical width of the stacked (phone) layout. */
export const STACKED_W = 288;
/** Largest zoom, in half steps. */
export const MAX_ZOOM = 8;
/** Below this viewport width the log stacks under the board. */
export const STACK_BELOW = 640;

export interface Fit {
  zoom: number;
  stacked: boolean;
}

/** Half-step zoom (1, 1.5, 2, ...) on desktop; quarter-step fit-to-width on phones. */
export function computeFit(width: number, height: number): Fit {
  if (width < STACK_BELOW) {
    return {
      zoom: Math.max(1, Math.min(3, Math.floor((width / STACKED_W) * 4) / 4)),
      stacked: true,
    };
  }
  const zoom = Math.floor(Math.min(width / WINDOW_W, height / WINDOW_H) * 2) / 2;
  return { zoom: Math.max(1, Math.min(MAX_ZOOM, zoom)), stacked: false };
}

export function useFit(): Fit {
  const [fit, setFit] = useState<Fit>(() => computeFit(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onResize = () => {
      const next = computeFit(window.innerWidth, window.innerHeight);
      setFit((prev) => (prev.zoom === next.zoom && prev.stacked === next.stacked ? prev : next));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return fit;
}
