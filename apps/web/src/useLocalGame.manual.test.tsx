import { act, renderHook } from "@testing-library/react";
import {
  configFromSettings,
  createSeededRng,
  legalMovesFromView,
  phaseOf,
  type Square,
} from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { useLocalGame } from "./useLocalGame";

// 3.10 Manual mine mode in local play

const config = configFromSettings({ reshuffleInterval: 2, densityPercent: 30, mode: "manual" });
const SQUARES: Square[] = [16, 17, 18, 19, 20]; // a3..e3

function start() {
  return renderHook(() => useLocalGame({ rng: createSeededRng(9), config }));
}

describe("useLocalGame in Manual mine mode", () => {
  it("runs White, handoff, Black, handoff, then play", () => {
    const { result } = start();
    expect(phaseOf(result.current.view).kind).toBe("placement");
    expect(result.current.placingColor).toBe("w");
    expect(result.current.view.placement?.quota).toBe(5);
    expect(result.current.handoffTo).toBeNull();

    act(() => {
      for (const sq of SQUARES) result.current.togglePlacement(sq);
    });
    expect(result.current.view.placement?.own).toEqual(SQUARES);
    // Clicking a placed square takes it back.
    act(() => {
      result.current.togglePlacement(20);
    });
    expect(result.current.view.placement?.own).toEqual([16, 17, 18, 19]);

    act(() => {
      result.current.donePlacement();
    });
    expect(result.current.handoffTo).toBe("b");
    expect(result.current.handoffPlacing).toBe(true);
    act(() => {
      result.current.dismissHandoff();
    });
    expect(result.current.placingColor).toBe("b");
    // Black sees only their own (empty) draft.
    expect(result.current.view.placement?.own).toEqual([]);

    act(() => {
      result.current.donePlacement();
    });
    expect(phaseOf(result.current.view).kind).toBe("play");
    expect(result.current.handoffTo).toBe("w");
    expect(result.current.handoffPlacing).toBe(false);
    expect(result.current.view.mineCount).toBe(10);
    // White placed 4 of 5 and Black none: the engine filled 1 and 5 at random.
    expect(result.current.autoPlaced).toBe(1);
  });

  it("starts a new placement round after a reshuffle, White first", () => {
    const { result } = start();
    act(() => {
      result.current.donePlacement();
    });
    act(() => {
      result.current.dismissHandoff();
    });
    act(() => {
      result.current.donePlacement();
    });
    act(() => {
      result.current.dismissHandoff();
    });
    expect(phaseOf(result.current.view).kind).toBe("play");

    for (let i = 0; i < 12 && phaseOf(result.current.view).kind === "play"; i++) {
      const move = legalMovesFromView(result.current.view).find((m) => m.captured === null);
      if (!move) throw new Error("no quiet move");
      act(() => {
        result.current.play(move);
      });
      act(() => {
        result.current.dismissHandoff();
      });
    }
    expect(phaseOf(result.current.view).kind).toBe("placement");
    expect(phaseOf(result.current.view)).toMatchObject({ round: 2 });
    expect(result.current.placingColor).toBe("w");
    expect(result.current.view.mineCount).toBe(0);
    expect(result.current.view.placement?.own).toEqual([]);
  });

  it("makes no move possible during placement", () => {
    const { result } = start();
    const move = legalMovesFromView(result.current.view)[0];
    if (!move) throw new Error("no move");
    let error: unknown = null;
    act(() => {
      error = result.current.play(move);
    });
    expect(error).not.toBeNull();
    expect(phaseOf(result.current.view).kind).toBe("placement");
  });

  it("an Auto game is unchanged: play from the start, no placement", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(9) }));
    expect(phaseOf(result.current.view).kind).toBe("play");
    expect(result.current.view.placement ?? null).toBeNull();
    expect(result.current.placingColor).toBeNull();
    expect(result.current.autoPlaced).toBeNull();
  });
});
