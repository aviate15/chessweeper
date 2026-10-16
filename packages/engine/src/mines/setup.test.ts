import { describe, expect, it } from "vitest";
import { rankOf } from "../chess/square";
import { DEFAULT_CONFIG } from "./config";
import { createSeededRng } from "./rng";
import { gameFromScenario } from "./scenario";
import { createGame } from "./setup";
import { maxMinesIn3x3 } from "./test-utils";

describe("createGame", () => {
  // 3.1: about 10 mines (30% of the 32 squares on ranks 3-6), ranks 3-6 only; the 3x3
  // limit can leave the odd game one or two short.
  it("places about 10 mines on ranks 3-6, never under a piece", () => {
    for (let seed = 0; seed < 200; seed++) {
      const game = createGame({ rng: createSeededRng(seed) });
      expect(game.hidden.mines.size).toBeLessThanOrEqual(10);
      expect(game.hidden.mines.size).toBeGreaterThanOrEqual(8);
      for (const mine of game.hidden.mines) {
        expect(rankOf(mine)).toBeGreaterThanOrEqual(2);
        expect(rankOf(mine)).toBeLessThanOrEqual(5);
        expect(game.position.board[mine]).toBeNull();
      }
    }
  });

  // 3.1: the default is 10 mines (30% of 32); the spread limit rarely leaves a game short.
  it("reaches the full 10 mines in nearly every game", () => {
    let full = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (createGame({ rng: createSeededRng(seed) }).hidden.mines.size === 10) full += 1;
    }
    expect(full).toBeGreaterThanOrEqual(190);
  });

  // 3.1: at most 2 mines in any 3x3 area.
  it("never puts more than 2 mines in a 3x3 area", () => {
    for (let seed = 0; seed < 200; seed++) {
      const game = createGame({ rng: createSeededRng(seed) });
      expect(maxMinesIn3x3(game.hidden.mines)).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const layout = (seed: number) =>
      [...createGame({ rng: createSeededRng(seed) }).hidden.mines].sort((a, b) => a - b);
    expect(layout(5)).toEqual(layout(5));
    expect(layout(5)).not.toEqual(layout(6));
  });

  // 3.6: kings start with 3 lives. 3.2: starting squares start hidden, nothing revealed.
  it("starts with 3 lives each, nothing revealed, no craters", () => {
    const game = createGame({ rng: createSeededRng(1) });
    expect(game.public.lives).toEqual({ w: 3, b: 3 });
    expect(game.public.revealed.size).toBe(0);
    expect(game.public.craters.size).toBe(0);
    expect(game.public.noCaptureCount).toBe(0);
  });

  it("honours a custom density and cap", () => {
    const game = createGame({
      rng: createSeededRng(1),
      config: { ...DEFAULT_CONFIG, mineDensity: 0.5, mineCap: 10 },
    });
    expect(game.hidden.mines.size).toBe(10);
  });
});

describe("gameFromScenario", () => {
  // 3.5: no mine ever sits under a piece.
  it("rejects a mine under a piece", () => {
    expect(() =>
      gameFromScenario({ fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", mines: ["e1"] }),
    ).toThrow();
  });
});
