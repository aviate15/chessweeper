// 3.3 flags are private notes; 3.7 a reshuffle clears them.
import { describe, expect, it } from "vitest";
import { flagsAfterEvents, noFlags, toggleFlag } from "./flags";

describe("flags", () => {
  it("toggles a flag on and off without mutating the input", () => {
    const empty = noFlags();
    const one = toggleFlag(empty, 28);
    expect([...empty]).toEqual([]);
    expect([...one]).toEqual([28]);
    expect([...toggleFlag(one, 28)]).toEqual([]);
  });

  // 3.3: no limit and no rules effect, so any number of squares can be flagged.
  it("has no limit", () => {
    let flags = noFlags();
    for (let square = 0; square < 64; square++) flags = toggleFlag(flags, square);
    expect(flags.size).toBe(64);
  });

  // 3.7: a Reshuffled event clears all flags; other events leave them alone.
  it("clears on a reshuffle only", () => {
    const flags = toggleFlag(noFlags(), 10);
    expect(flagsAfterEvents(flags, [{ type: "TurnPassed", to: "b" }])).toBe(flags);
    const cleared = flagsAfterEvents(flags, [
      { type: "TurnPassed", to: "b" },
      { type: "Reshuffled", mineCount: 8 },
    ]);
    expect(cleared.size).toBe(0);
  });
});
