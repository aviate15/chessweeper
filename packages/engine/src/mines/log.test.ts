import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { gameFromScenario } from "./scenario";
import { eventTypes, play } from "./test-utils";

describe("public move log", () => {
  // 3.1, 3.8: the log keeps public events only; MineRelocated is server-only.
  it("records each move's public events and never MineRelocated", () => {
    const game = gameFromScenario({
      fen: START_FEN,
      mines: ["e4"],
      safeStart: { w: true, b: true },
    });
    const { state, events } = play(game, "e2e4");
    expect(eventTypes(events)).toContain("MineRelocated");
    expect(state.public.log).toHaveLength(1);
    expect(state.public.log[0]?.color).toBe("w");
    expect(eventTypes(state.public.log[0]?.events ?? [])).not.toContain("MineRelocated");
    expect(eventTypes(state.public.log[0]?.events ?? [])).toContain("MoveMade");
  });

  // 3.4: a check-exception chain is several moves but one turn; each move is logged.
  it("appends one entry per move and leaves the input state untouched", () => {
    const game = gameFromScenario({ fen: START_FEN });
    const one = play(game, "e2e4").state;
    const two = play(one, "e7e5").state;
    expect(game.public.log).toHaveLength(0);
    expect(one.public.log).toHaveLength(1);
    expect(two.public.log.map((entry) => entry.color)).toEqual(["w", "b"]);
  });
});
