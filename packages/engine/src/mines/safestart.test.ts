// 3.1 safe start: each side's first move of the game cannot hit a mine (lazy relocation).
import { describe, expect, it } from "vitest";
import { parseFen, START_FEN } from "../chess/fen";
import { rankOf } from "../chess/square";
import { isPublicEvent, type GameEvent } from "./events";
import type { Working } from "./landing";
import { revealedNumbers } from "./numbers";
import { createSeededRng } from "./rng";
import { relocateSafeStartMine } from "./safestart";
import { gameFromScenario } from "./scenario";
import { eventTypes, play, sq } from "./test-utils";

const BOTH = { w: true, b: true };

function relocation(events: readonly GameEvent[]) {
  const event = events.find((e) => e.type === "MineRelocated");
  if (event?.type !== "MineRelocated") throw new Error("no relocation");
  return event;
}

describe("safe start", () => {
  const start = (mines: string[]) => gameFromScenario({ fen: START_FEN, mines, safeStart: BOTH });

  it("moves the mine away from the first landing square, so the piece survives", () => {
    const { state, events } = play(start(["e4", "a5", "h6"]), "e2e4");
    expect(state.position.board[sq("e4")]?.type).toBe("p");
    expect(state.public.revealed.has(sq("e4"))).toBe(true);
    expect(eventTypes(events)).not.toContain("MineTriggered");
    expect(state.hidden.mines.has(sq("e4"))).toBe(false);
    expect(state.hidden.mines.size).toBe(3); // the mine moved; none was lost or consumed
  });

  // 3.1: only the landing square is protected; other mines stay where they are.
  it("leaves every other mine alone", () => {
    const { state } = play(start(["e4", "a5", "h6"]), "e2e4");
    expect(state.hidden.mines.has(sq("a5"))).toBe(true);
    expect(state.hidden.mines.has(sq("h6"))).toBe(true);
  });

  it("does nothing when the landing square is safe", () => {
    const { events } = play(start(["a5"]), "e2e4");
    expect(eventTypes(events)).not.toContain("MineRelocated");
  });

  // 3.1: the new square is a free square on ranks 3-6 (no piece, no mine, not the old square).
  it("relocates to a free square on ranks 3-6", () => {
    for (let seed = 0; seed < 100; seed++) {
      const { state, events } = play(start(["e4", "a5"]), "e2e4", createSeededRng(seed));
      const to = relocation(events).to;
      if (to === null) throw new Error("dropped");
      expect(rankOf(to)).toBeGreaterThanOrEqual(2);
      expect(rankOf(to)).toBeLessThanOrEqual(5);
      expect(to).not.toBe(sq("e4"));
      expect(to).not.toBe(sq("a5"));
      expect(state.position.board[to]).toBeNull();
      expect(state.hidden.mines.has(to)).toBe(true);
    }
  });

  // 3.1: the relocation is not a reshuffle and does not touch the counter.
  it("does not affect the reshuffle counter", () => {
    const { state, events } = play(start(["e4"]), "e2e4");
    expect(state.public.noCaptureCount).toBe(1); // the ordinary tick for the turn, nothing more
    expect(eventTypes(events)).not.toContain("Reshuffled");
  });

  // 3.1: the relocation is invisible to players: its event is server-only.
  it("emits a server-only event", () => {
    const { events } = play(start(["e4"]), "e2e4");
    expect(isPublicEvent(relocation(events))).toBe(false);
    expect(events.filter(isPublicEvent).every((e) => e.type !== ("MineRelocated" as string))).toBe(
      true,
    );
  });

  it("is deterministic for a seed", () => {
    const to = (seed: number) =>
      relocation(play(start(["e4"]), "e2e4", createSeededRng(seed)).events).to;
    expect(to(9)).toBe(to(9));
    expect(new Set(Array.from({ length: 30 }, (_, seed) => to(seed))).size).toBeGreaterThan(1);
  });

  // 3.1: each side gets exactly one protected move, its first of the game.
  describe("each side's first move", () => {
    it("protects Black's first move too, without changing any revealed number", () => {
      // 1.e4 reveals e4; the mine on d5 contributes to it. Black's d7-d5 moves that mine away.
      for (let seed = 0; seed < 60; seed++) {
        const rng = createSeededRng(seed);
        const afterWhite = play(start(["d5", "a5", "h6", "c4"]), "e2e4", rng).state;
        const before = revealedNumbers(afterWhite);
        const { state, events } = play(afterWhite, "d7d5", rng);
        expect(eventTypes(events)).not.toContain("MineTriggered");
        expect(state.position.board[sq("d5")]?.type).toBe("p");
        // e4 is the only square revealed before Black moved: its number must be unchanged.
        expect(revealedNumbers(state).get(sq("e4"))).toBe(before.get(sq("e4")));
        expect(eventTypes(events)).not.toContain("NumbersChanged");
      }
    });

    it("protects only the first move of each side", () => {
      const rng = createSeededRng(1);
      let state = start(["c3"]);
      state = play(state, "e2e4", rng).state; // White's first move (safe square anyway)
      state = play(state, "d7d5", rng).state; // Black's first move
      const { events } = play(state, "b1c3", rng); // White's second move: not protected
      expect(eventTypes(events)).toContain("MineTriggered");
    });
  });

  // 3.1 (decided fallback): widen to any rank, then drop the mine; the first move stays safe.
  describe("when ranks 3-6 have no suitable square", () => {
    /** A scratch state for the helper: kings and a rook, landing square a4 holds a mine. */
    function work(mines: number[]): Working {
      const board = parseFen("4k3/8/8/8/R7/8/8/4K3 w - - 0 1").board.slice();
      return {
        board,
        mines: new Set(mines),
        craters: new Set(),
        revealed: new Set(),
        lives: { w: 3, b: 3 },
        events: [],
      };
    }
    const everySquare = Array.from({ length: 64 }, (_, i) => i);
    const emptySquares = (w: Working) => everySquare.filter((s) => w.board[s] === null);

    it("widens to another rank", () => {
      const w = work([]);
      for (const s of emptySquares(w)) if (rankOf(s) >= 2 && rankOf(s) <= 5) w.mines.add(s);
      w.mines.add(sq("a4"));
      relocateSafeStartMine(w, sq("a4"), createSeededRng(1));
      const moved = w.events[0];
      if (moved?.type !== "MineRelocated" || moved.to === null) throw new Error("dropped");
      expect(rankOf(moved.to) < 2 || rankOf(moved.to) > 5).toBe(true);
      expect(w.board[moved.to]).toBeNull();
      expect(w.mines.has(moved.to)).toBe(true);
    });

    it("tells revealed neighbours when a dropped mine changes their number", () => {
      const w = work([]);
      for (const s of emptySquares(w)) w.mines.add(s);
      w.mines.add(sq("a4"));
      w.revealed.add(sq("a5")); // next to a4
      w.mines.delete(sq("a5"));
      relocateSafeStartMine(w, sq("a4"), createSeededRng(1));
      expect(w.events.map((e) => e.type)).toEqual(["MineRelocated", "NumbersChanged"]);
    });

    it("removes the mine when no free square exists at all", () => {
      const w = work([]);
      for (const s of emptySquares(w)) w.mines.add(s);
      w.mines.add(sq("a4")); // under the moved piece, as in a real first move
      const before = w.mines.size;
      relocateSafeStartMine(w, sq("a4"), createSeededRng(1));
      expect(w.mines.size).toBe(before - 1);
      expect(w.events).toEqual([{ type: "MineRelocated", from: sq("a4"), to: null }]);
    });
  });
});
