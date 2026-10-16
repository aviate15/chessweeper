// Invariants of the mine rules over many random games (design doc 3.1-3.6).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { legalMoves } from "../chess/movegen";
import { fileOf, rankOf } from "../chess/square";
import { revealedNumbers } from "./numbers";
import { createSeededRng } from "./rng";
import { resolveMove } from "./resolve";
import { createGame } from "./setup";
import type { GameState } from "./state";

/** Plain recount of adjacent mines, independent of the engine's helper. */
function bruteForceCount(state: GameState, square: number): number {
  let count = 0;
  for (const mine of state.hidden.mines) {
    const df = Math.abs(fileOf(mine) - fileOf(square));
    const dr = Math.abs(rankOf(mine) - rankOf(square));
    if (mine !== square && df <= 1 && dr <= 1) count += 1;
  }
  return count;
}

const snapshot = (s: GameState) =>
  JSON.stringify([
    s.position,
    [...s.hidden.mines].sort((a, b) => a - b),
    [...s.public.craters].sort((a, b) => a - b),
    [...s.public.revealed].sort((a, b) => a - b),
    s.public.lives,
  ]);

function checkInvariants(state: GameState, initialMines: number): void {
  // 3.1, 3.5: no mine is ever under a piece.
  for (const mine of state.hidden.mines) expect(state.position.board[mine]).toBeNull();
  // A square is a live mine, a crater, or neither; never both. Revealed squares held no mine.
  for (const crater of state.public.craters) expect(state.hidden.mines.has(crater)).toBe(false);
  for (const square of state.public.revealed) expect(state.hidden.mines.has(square)).toBe(false);
  // Mines are conserved in M5: each is either live or a crater.
  expect(state.hidden.mines.size + state.public.craters.size).toBe(initialMines);
  // 3.6: lives stay within 0..3.
  for (const lives of [state.public.lives.w, state.public.lives.b]) {
    expect(lives).toBeGreaterThanOrEqual(0);
    expect(lives).toBeLessThanOrEqual(3);
  }
  // 3.2: live numbers match a brute-force recount.
  for (const [square, number] of revealedNumbers(state)) {
    expect(number).toBe(bruteForceCount(state, square));
  }
}

describe("mine invariants over random games", () => {
  it("hold after every ordinary move", () => {
    const seen = { explosions: 0, reveals: 0 };
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 60 }),
        (seed, choices) => {
          let state = createGame({ rng: createSeededRng(seed) });
          const initialMines = state.hidden.mines.size;
          checkInvariants(state, initialMines);

          for (const choice of choices) {
            if (state.public.status.kind === "over") break;
            const moves = legalMoves(state.position).filter(
              (m) => m.castle === null && !m.enPassant && m.promotion === null,
            );
            const move = moves[choice % Math.max(moves.length, 1)];
            if (move === undefined) break;
            const before = snapshot(state);
            const resolution = resolveMove(state, move);
            state = resolution.state;
            for (const event of resolution.events) {
              if (event.type === "PieceDestroyed") seen.explosions += 1;
              if (event.type === "NumberRevealed") seen.reveals += 1;
            }
            expect(snapshot(state)).not.toBe(before);
            checkInvariants(state, initialMines);
          }
        },
      ),
      { numRuns: 300 },
    );
    // Make sure the run was not vacuous. (Random play rarely moves a king this early, so king
    // hits are covered by the unit tests in resolve.test.ts.)
    expect(seen.explosions).toBeGreaterThan(0);
    expect(seen.reveals).toBeGreaterThan(0);
  });

  it("never mutates the input state", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const state = createGame({ rng: createSeededRng(seed) });
        const before = snapshot(state);
        for (const move of legalMoves(state.position)) {
          if (move.castle !== null || move.enPassant || move.promotion !== null) continue;
          resolveMove(state, move);
          expect(snapshot(state)).toBe(before);
        }
      }),
      { numRuns: 50 },
    );
  });
});
