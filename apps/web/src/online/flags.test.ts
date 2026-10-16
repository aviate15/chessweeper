import {
  createGame,
  createSeededRng,
  noFlags,
  toPublicView,
  type PublicView,
} from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { flagsAfterSnapshot } from "./flags";

function viewWithLog(log: PublicView["log"]): PublicView {
  return { ...toPublicView(createGame({ rng: createSeededRng(1) }), "w"), log };
}

const moved = { color: "w", events: [{ type: "TurnPassed", to: "b" }] } as const;
const reshuffled = { color: "b", events: [{ type: "Reshuffled", mineCount: 8 }] } as const;

describe("flagsAfterSnapshot", () => {
  const flags = new Set([4, 9]);

  it("keeps flags when nothing was missed", () => {
    expect(flagsAfterSnapshot(flags, 1, viewWithLog([moved, moved]))).toBe(flags);
  });
  it("clears flags when a reshuffle happened after the last log length seen", () => {
    expect(flagsAfterSnapshot(flags, 1, viewWithLog([moved, reshuffled]))).toEqual(noFlags());
  });
  it("ignores a reshuffle the flags already saw", () => {
    expect(flagsAfterSnapshot(flags, 2, viewWithLog([moved, reshuffled]))).toBe(flags);
  });
  it("keeps flags for a fresh join and clears them if the log shrank", () => {
    expect(flagsAfterSnapshot(flags, null, viewWithLog([reshuffled]))).toBe(flags);
    expect(flagsAfterSnapshot(flags, 5, viewWithLog([moved]))).toEqual(noFlags());
  });
});
