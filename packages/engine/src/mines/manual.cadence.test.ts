// 3.7, 3.10 Manual mine mode: the reshuffle falls every N turns, captures never reset it.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { DEFAULT_CONFIG } from "./config";
import { gameFromScenario, type Scenario } from "./scenario";
import { eventTypes, play } from "./test-utils";

const MANUAL = { ...DEFAULT_CONFIG, mode: "manual" as const, reshuffleInterval: 10 };
const manual = (scenario: Omit<Scenario, "config">) =>
  gameFromScenario({ ...scenario, config: MANUAL });

const CAPTURE_FEN = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";

describe("3.10 fixed reshuffle cadence", () => {
  it("a capture does not reset the counter in Manual mode", () => {
    const { state } = play(manual({ fen: CAPTURE_FEN, noCaptureCount: 5 }), "e4d5");
    expect(state.public.noCaptureCount).toBe(6);
  });

  it("a capture does not postpone the reshuffle that is due", () => {
    const game = manual({ fen: CAPTURE_FEN, noCaptureCount: 9 });
    const { state, events } = play(game, "e4d5");
    expect(eventTypes(events)).toContain("Reshuffled");
    expect(eventTypes(events)).toContain("PlacementStarted");
    expect(state.public.noCaptureCount).toBe(0); // 3.10 a placement round restarts it
  });

  it("a turn with an explosion counts as a normal turn", () => {
    const game = manual({ fen: START_FEN, owned: { w: ["e4"] }, noCaptureCount: 2 });
    const { state, events } = play(game, "e2e4");
    expect(eventTypes(events)).toContain("MineTriggered");
    expect(state.public.noCaptureCount).toBe(3);
  });

  it("Auto mode is unchanged: a capture still resets the counter (3.7)", () => {
    const game = gameFromScenario({
      fen: CAPTURE_FEN,
      config: DEFAULT_CONFIG,
      noCaptureCount: 3,
    });
    const { state } = play(game, "e4d5");
    expect(state.public.noCaptureCount).toBe(0);
  });
});
