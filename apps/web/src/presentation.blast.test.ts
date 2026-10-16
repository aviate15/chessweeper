import { describe, expect, it } from "vitest";
import type { BigMineBlastedEvent } from "./components/placementTypes";
import { BLAST_RING_MS, MAX_BLOCKING_MS, presentationFor } from "./presentation";

// 3.10 big mine blast

const blast: BigMineBlastedEvent = {
  type: "BigMineBlasted",
  square: 28,
  by: { color: "w", type: "n" },
  area: [19, 20, 21, 27, 28, 29, 35, 36, 37],
};

describe("presentationFor BigMineBlasted", () => {
  it("emits one blast effect over the whole area and blocks for it", () => {
    const p = presentationFor([blast], { reducedMotion: false });
    expect(p.fx).toEqual([
      expect.objectContaining({ kind: "blast", square: 28, area: blast.area }),
    ]);
    expect(p.blockingMs).toBeGreaterThan(0);
    expect(p.blockingMs).toBeLessThanOrEqual(MAX_BLOCKING_MS);
  });

  it("does nothing under reduced motion", () => {
    expect(presentationFor([blast], { reducedMotion: true })).toEqual({ blockingMs: 0, fx: [] });
  });

  it("exposes the per-ring stagger", () => {
    expect(BLAST_RING_MS).toBeGreaterThan(0);
  });
});
