import { useEffect, useState } from "react";

/** Logical (unscaled) window size in CSS px, side-by-side layout. */
export const WINDOW_W = 410;
export const WINDOW_H = 446;
/** Logical width of the stacked (phone) layout. */
export const STACKED_W = 288;
/** Below this viewport width the log stacks under the board. */
export const STACK_BELOW = 640;

export interface Fit {
  zoom: number;
  stacked: boolean;
}

/** Whole-number zoom on desktop; fit-to-width (still pixel-crisp) on phones. */
export function computeFit(width: number, height: number): Fit {
  if (width < STACK_BELOW) {
    return {
      zoom: Math.max(1, Math.min(3, Math.floor((width / STACKED_W) * 4) / 4)),
      stacked: true,
    };
  }
  const zoom = Math.floor(Math.min(width / WINDOW_W, height / WINDOW_H));
  return { zoom: Math.max(1, Math.min(4, zoom)), stacked: false };
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
