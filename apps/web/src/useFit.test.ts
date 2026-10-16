import { describe, expect, it } from "vitest";
import { MAX_ZOOM, STACK_BELOW, STACKED_W, WINDOW_H, WINDOW_W, computeFit } from "./useFit";

describe("computeFit", () => {
  it("never goes below zoom 1 on a small desktop viewport", () => {
    expect(computeFit(STACK_BELOW, 200)).toEqual({ zoom: 1, stacked: false });
  });

  it("uses a half-step zoom limited by the tighter dimension", () => {
    expect(computeFit(WINDOW_W * 3, WINDOW_H * 5)).toEqual({ zoom: 3, stacked: false });
    expect(computeFit(WINDOW_W * 5, WINDOW_H * 2 + 10)).toEqual({ zoom: 2, stacked: false });
    expect(computeFit(WINDOW_W * 3 - 1, WINDOW_H * 9).zoom).toBe(2.5);
    expect(computeFit(WINDOW_W * 9, WINDOW_H * 1.5 + 1).zoom).toBe(1.5);
  });

  it("allows zooms above the old cap of 4 and stops at the new cap", () => {
    expect(computeFit(WINDOW_W * 6, WINDOW_H * 6).zoom).toBe(6);
    expect(computeFit(WINDOW_W * 20, WINDOW_H * 20).zoom).toBe(MAX_ZOOM);
  });

  it("fits 1920x1080 at zoom 2, 1440x900 at 2 and 1280x800 at 1.5 (height bound)", () => {
    expect(computeFit(1920, 1080).zoom).toBe(2);
    expect(computeFit(1440, 900).zoom).toBe(2);
    expect(computeFit(1280, 800).zoom).toBe(1.5);
  });

  it("stacks on phones with a quarter-step fit-to-width zoom", () => {
    const fit = computeFit(STACK_BELOW - 1, 900);
    expect(fit.stacked).toBe(true);
    expect(fit.zoom).toBeGreaterThanOrEqual(1);
    expect(fit.zoom).toBeLessThanOrEqual(3);
    expect(computeFit(STACKED_W, 900).zoom).toBe(1);
  });
});
