// 3.7 reshuffle and 3.8 step 8 ordering.
import { describe, expect, it } from "vitest";
import { rankOf } from "../chess/square";
import { DEFAULT_CONFIG, mineCountFor } from "./config";
import { createSeededRng } from "./rng";
import { gameFromScenario } from "./scenario";
import { eventTypes, play } from "./test-utils";

const ROOK = "4k3/8/8/8/R7/8/8/4K3 w - - 0 1"; // 3 pieces, 61 free squares
const BLOCK = "b3k3/8/8/8/8/8/8/4R2K b - - 0 1";

const reshuffled = (events: readonly { type: string }[]) =>
  eventTypes(events).includes("Reshuffled");

describe("reshuffle", () => {
  const due = () =>
    gameFromScenario({
      fen: ROOK,
      mines: ["d4"],
      revealed: ["b6", "h8"],
      craters: ["c3"],
      lives: { w: 2, b: 3 },
      noCaptureCount: 9,
    });

  it("fires when the counter reaches 10, then resets everything", () => {
    const { state, events } = play(due(), "a4a5");
    expect(eventTypes(events).slice(-2)).toEqual(["TurnPassed", "Reshuffled"]);
    expect(state.public.noCaptureCount).toBe(0);
    expect(state.public.revealed.size).toBe(0); // numbers are re-hidden
    expect(state.public.craters.size).toBe(0);
    expect(state.public.lives).toEqual({ w: 2, b: 3 }); // lives are untouched
  });

  // 3.7: count = round-half-up(mineDensity × free squares): 61 × 0.25 = 15.25 → 15.
  it("places round_half_up(density × free squares) mines, only on unoccupied squares", () => {
    const { state, events } = play(due(), "a4a5");
    expect(state.hidden.mines.size).toBe(mineCountFor(61, DEFAULT_CONFIG));
    expect(state.hidden.mines.size).toBe(15);
    expect(events.at(-1)).toEqual({ type: "Reshuffled", mineCount: 15 });
    for (const mine of state.hidden.mines) expect(state.position.board[mine]).toBeNull();
  });

  // 3.7: the count follows the board, and the cap applies.
  it("grows denser with fewer pieces and respects the cap", () => {
    const dense = gameFromScenario({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      noCaptureCount: 9,
      config: { ...DEFAULT_CONFIG, mineDensity: 0.5 },
    });
    expect(play(dense, "e1e2").state.hidden.mines.size).toBe(31); // 62 free × 0.5
    const capped = gameFromScenario({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      noCaptureCount: 9,
      config: { ...DEFAULT_CONFIG, mineDensity: 0.5, mineCap: 10 },
    });
    expect(play(capped, "e1e2").state.hidden.mines.size).toBe(10);
  });

  // 3.7: placement is uniform over all unoccupied squares, including ranks 1-2 and 7-8.
  it("can place mines on any rank", () => {
    const ranks = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      for (const mine of play(due(), "a4a5", createSeededRng(seed)).state.hidden.mines) {
        ranks.add(rankOf(mine));
      }
    }
    expect(ranks.size).toBe(8);
  });

  it("is deterministic for a seed", () => {
    const layout = (seed: number) =>
      [...play(due(), "a4a5", createSeededRng(seed)).state.hidden.mines].sort((a, b) => a - b);
    expect(layout(3)).toEqual(layout(3));
    expect(layout(3)).not.toEqual(layout(4));
  });

  it("does not fire before the counter reaches 10", () => {
    const game = gameFromScenario({ fen: ROOK, noCaptureCount: 8 });
    const { state, events } = play(game, "a4a5");
    expect(reshuffled(events)).toBe(false);
    expect(state.public.noCaptureCount).toBe(9);
  });

  it("does not fire on a capture turn", () => {
    const game = gameFromScenario({ fen: "4k3/8/8/8/R6p/8/8/4K3 w - - 0 1", noCaptureCount: 9 });
    expect(reshuffled(play(game, "a4h4").events)).toBe(false);
  });
});

describe("reshuffle timing (3.7, 3.8 step 8)", () => {
  // 3.7: only if the game continues.
  it("does not fire on the turn that ends the game by checkmate", () => {
    const game = gameFromScenario({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", noCaptureCount: 9 });
    const { state, events } = play(game, "a1a8");
    expect(state.public.status.kind).toBe("over");
    expect(reshuffled(events)).toBe(false);
    expect(state.public.noCaptureCount).toBe(9);
  });

  it("does not fire on a stalemate or a king death", () => {
    const stale = gameFromScenario({ fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", noCaptureCount: 9 });
    expect(reshuffled(play(stale, "f1f7").events)).toBe(false);
    const dead = gameFromScenario({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      mines: ["e2"],
      lives: { w: 1, b: 3 },
      noCaptureCount: 9,
    });
    expect(reshuffled(play(dead, "e1e2").events)).toBe(false);
  });

  // 3.7: after the whole check-exception chain, not before.
  it("waits for the check-exception chain to finish", () => {
    const game = gameFromScenario({ fen: BLOCK, mines: ["e4"], noCaptureCount: 9 });
    const pending = play(game, "a8e4");
    expect(reshuffled(pending.events)).toBe(false);
    expect(pending.state.public.noCaptureCount).toBe(9);
    const done = play(pending.state, "e8d8");
    expect(reshuffled(done.events)).toBe(true);
    expect(done.state.public.noCaptureCount).toBe(0);
  });
});
