// 3.10 Manual mine mode: blast edge cases, game-end interplay and a property test.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { legalMoves } from "../chess/movegen";
import { fileOf, rankOf } from "../chess/square";
import { DEFAULT_CONFIG } from "./config";
import { liveMineCount, revealedNumbers } from "./numbers";
import { finishPlacement, placeMine } from "./placement";
import { GameOverError, resolveMove } from "./resolve";
import { createSeededRng } from "./rng";
import { gameFromScenario, type Scenario } from "./scenario";
import { createGame } from "./setup";
import type { GameState } from "./state";
import { eventTypes, play, sq } from "./test-utils";

const MANUAL = { ...DEFAULT_CONFIG, mode: "manual" as const, reshuffleInterval: 10 };
const manual = (scenario: Omit<Scenario, "config">, config = MANUAL) =>
  gameFromScenario({ ...scenario, config });
const both = (...squares: string[]) => ({ w: squares, b: squares });

describe("3.10 blast on a promotion square", () => {
  it("reports the original pawn as destroyed; it does not promote", () => {
    const game = manual({ fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", owned: both("a8") });
    const { state, events } = play(game, "a7a8q");
    const destroyed = events.filter((e) => e.type === "PieceDestroyed");
    expect(destroyed).toEqual([
      { type: "PieceDestroyed", square: sq("a8"), piece: { color: "w", type: "p" } },
    ]);
    expect(state.position.board[sq("a8")]).toBeNull();
  });
});

describe("3.10 blast clipped at the board edge", () => {
  it("an edge square blasts 6 squares", () => {
    const game = manual({ fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", owned: both("a4") });
    const { state, events } = play(game, "a1a4");
    const blast = events.find((e) => e.type === "BigMineBlasted");
    if (blast?.type !== "BigMineBlasted") throw new Error("no blast");
    expect(blast.area).toHaveLength(6);
    expect(state.public.craters.size).toBe(6);
    expect([...state.public.craters].every((s) => fileOf(s) <= 1)).toBe(true);
  });

  it("a corner square blasts 4 squares", () => {
    const game = manual({ fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", owned: both("a8") });
    const { state } = play(game, "a7a8q");
    expect(state.public.craters.size).toBe(4);
  });
});

describe("3.10 kings dying in a blast", () => {
  it("a king lander on its last life dies there: the mover loses", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      owned: both("e2"),
      lives: { w: 1, b: 3 },
    });
    const { state } = play(game, "e1e2");
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
  });

  it("castling: the rook does not land when the king's landing ends the game", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
      owned: both("c1"),
      lives: { w: 1, b: 3 },
    });
    const { state } = play(game, "e1c1");
    expect(state.public.status.kind).toBe("over");
    expect(state.public.revealed.has(sq("d1"))).toBe(false); // the rook never landed
  });

  it("a king merely caught in a blast reveals nothing", () => {
    const game = manual({
      fen: "8/8/8/4k3/8/2K5/8/3R4 w - - 0 1",
      owned: both("d4"),
    });
    const { state, events } = play(game, "d1d4");
    expect(state.public.revealed.size).toBe(0);
    expect(eventTypes(events)).not.toContain("NumberRevealed");
  });

  it("only the opponent's king losing its last life: the opponent's side loses (black mover)", () => {
    const game = manual({
      fen: "8/8/8/4K3/8/2k5/8/3r4 b - - 0 1",
      owned: both("d4"),
      lives: { w: 1, b: 3 },
    });
    const { state } = play(game, "d1d4");
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
  });
});

describe("3.10 game end after a blast", () => {
  it("no resolving move after the blast: checkmate, the mover loses", () => {
    // The bishop on g1 shields the white king on h1 from the black rook on a1. The knight
    // h3-f2 lands on the big mine; the blast kills the bishop. Knights on f4 and g4 cover the
    // escape squares g2 and h2.
    const game = manual({
      fen: "k7/8/8/8/5nn1/7N/8/r5BK w - - 0 1",
      owned: both("f2"),
    });
    const { state } = play(game, "h3f2");
    expect(state.position.board[sq("g1")]).toBeNull();
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "checkmate" });
  });

  it("stalemate for the opponent on the board the blast left is a draw", () => {
    // The blast kills the black knight on e3, black's only mobile piece.
    const game = manual({
      fen: "k7/p1Q5/P7/8/8/4n3/8/6NK w - - 0 1",
      owned: both("f3"),
    });
    const { state } = play(game, "g1f3");
    expect(state.position.board[sq("e3")]).toBeNull();
    expect(state.public.status).toEqual({ kind: "over", result: "draw", reason: "stalemate" });
  });

  it("a blast can be the follow-up move inside a check-exception chain (one turn)", () => {
    const game = manual({
      fen: "b3k3/8/8/8/8/8/8/4R2K b - - 0 1",
      owned: { w: ["e4", "d8"], b: ["d8"] },
    });
    const first = play(game, "a8e4").state; // single mine: blocker dies, check again
    expect(first.public.checkException).toBe("b");
    const { state, events } = play(first, "e8d8"); // the king steps onto the big mine
    expect(eventTypes(events)).toContain("BigMineBlasted");
    expect(state.public.lives.b).toBe(2);
    expect(state.public.craters.size).toBe(1 + 6); // e4 and the clipped 6-square area
    expect(state.public.checkException).toBeNull();
    expect(state.position.turn).toBe("w");
    expect(state.position.fullmoveNumber).toBe(2); // the whole chain was one turn
  });
});

describe("3.10 blast on the reshuffle turn", () => {
  const scenario = (config = MANUAL) =>
    manual(
      {
        fen: "4k3/8/8/8/6p1/8/4P3/4K1N1 w - - 0 1",
        owned: both("f3"),
        noCaptureCount: 1,
      },
      { ...config, reshuffleInterval: 2 },
    );

  it("the blast turn counts, the reshuffle fires, craters clear and placement starts", () => {
    const { state, events } = play(scenario(), "g1f3");
    expect(eventTypes(events).slice(-2)).toEqual(["Reshuffled", "PlacementStarted"]);
    expect(state.public.noCaptureCount).toBe(0);
    expect(state.public.craters.size).toBe(0);
    expect(state.hidden.mines.size).toBe(0);
    // Two kings left: 62 free squares, 30% / 2 -> 9.3 -> 9 each.
    expect(state.public.phase).toEqual({
      kind: "placement",
      round: 2,
      quota: 9,
      ready: { w: false, b: false },
    });
  });

  it("the mine cap (halved) limits the quota in a later round", () => {
    const { state } = play(scenario({ ...MANUAL, mineCap: 6 }), "g1f3");
    expect(state.public.phase).toMatchObject({ kind: "placement", round: 2, quota: 3 });
  });

  it("PlacementEnded.mineCount is 2 x the later quota", () => {
    const { state } = play(scenario(), "g1f3");
    const done = finishPlacement(state, createSeededRng(4));
    expect(done.events.at(-1)).toEqual({ type: "PlacementEnded", mineCount: 18 });
    expect(liveMineCount(done.state)).toBe(18); // a stacked square counts 2
  });
});

describe("3.10 property: random manual games keep their invariants", () => {
  const config = { ...MANUAL, reshuffleInterval: 3, mineDensity: 0.4 };

  function check(state: GameState): void {
    const owned = state.hidden.owned;
    if (owned == null) throw new Error("manual game without owners");
    expect([...state.hidden.mines].sort()).toEqual([...new Set([...owned.w, ...owned.b])].sort());
    expect(liveMineCount(state)).toBe(owned.w.size + owned.b.size);
    for (const mine of state.hidden.mines) {
      expect(state.position.board[mine]).toBeNull();
      expect(state.public.craters.has(mine)).toBe(false);
    }
    for (const [square, number] of revealedNumbers(state)) {
      let count = 0;
      for (const mine of state.hidden.mines) {
        const near =
          mine !== square &&
          Math.abs(fileOf(mine) - fileOf(square)) <= 1 &&
          Math.abs(rankOf(mine) - rankOf(square)) <= 1;
        if (near) count += (owned.w.has(mine) ? 1 : 0) + (owned.b.has(mine) ? 1 : 0);
      }
      expect(number).toBe(count);
    }
    expect(state.public.lives.w).toBeGreaterThanOrEqual(0);
    expect(state.public.lives.b).toBeGreaterThanOrEqual(0);
  }

  it("never throws, mines stay consistent, every round ends with 2 x quota mines", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (seed) => {
        const rng = createSeededRng(seed);
        let state = createGame({ rng, config });
        for (let step = 0; step < 80 && state.public.status.kind === "ongoing"; step++) {
          if (state.public.phase.kind === "placement") {
            const quota = state.public.phase.quota;
            const spot = rng.nextInt(60);
            const placed = placeMine(state, "w", spot);
            if (placed.ok) state = placed.state;
            state = finishPlacement(state, rng).state;
            expect(liveMineCount(state)).toBe(2 * quota);
          } else {
            const moves = legalMoves(state.position);
            const move = moves[rng.nextInt(moves.length)];
            if (move === undefined) break;
            state = resolveMove(state, move, rng).state;
          }
          check(state);
        }
        const next = legalMoves(state.position)[0];
        if (state.public.status.kind === "over" && next !== undefined) {
          expect(() => resolveMove(state, next, rng)).toThrow(GameOverError);
        }
      }),
      { numRuns: 150 },
    );
  });
});
