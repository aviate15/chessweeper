// 3.7 the no-capture counter.
import { describe, expect, it } from "vitest";
import { turnsUntilReshuffle } from "./counter";
import { gameFromScenario } from "./scenario";
import { play } from "./test-utils";

const ROOK = "4k3/8/8/8/R7/8/8/4K3 w - - 0 1";
const BLOCK = "b3k3/8/8/8/8/8/8/4R2K b - - 0 1";

describe("no-capture counter", () => {
  it("starts at 0 and ticks on a quiet turn", () => {
    const game = gameFromScenario({ fen: ROOK });
    expect(game.public.noCaptureCount).toBe(0);
    expect(play(game, "a4a5").state.public.noCaptureCount).toBe(1);
  });

  // 3.7: an explosion counts as a normal turn and does not reset the counter.
  it("ticks on an explosion turn", () => {
    const game = gameFromScenario({ fen: ROOK, mines: ["d4"], noCaptureCount: 3 });
    expect(play(game, "a4d4").state.public.noCaptureCount).toBe(4);
  });

  // 3.7: any turn that captures a piece resets the counter.
  it("resets to 0 on a capture", () => {
    const game = gameFromScenario({ fen: "4k3/8/8/8/R6p/8/8/4K3 w - - 0 1", noCaptureCount: 5 });
    expect(play(game, "a4h4").state.public.noCaptureCount).toBe(0);
  });

  // 3.7: an en passant capture whose capturer then explodes still removes a piece.
  it("resets to 0 on an en passant capture even when the capturer explodes", () => {
    const game = gameFromScenario({
      fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
      mines: ["d6"],
      noCaptureCount: 5,
    });
    expect(play(game, "e5d6").state.public.noCaptureCount).toBe(0);
  });

  // 3.7: a check-exception chain counts as one turn, and nothing changes while it is pending.
  it("counts a check-exception chain once", () => {
    const game = gameFromScenario({ fen: BLOCK, mines: ["e4"], noCaptureCount: 3 });
    const pending = play(game, "a8e4").state;
    expect(pending.public.checkException).toBe("b");
    expect(pending.public.noCaptureCount).toBe(3);
    expect(play(pending, "e8d8").state.public.noCaptureCount).toBe(4);
  });

  it("derives the turns until the reshuffle", () => {
    expect(turnsUntilReshuffle(gameFromScenario({ fen: ROOK }))).toBe(10);
    expect(turnsUntilReshuffle(gameFromScenario({ fen: ROOK, noCaptureCount: 4 }))).toBe(6);
  });
});
