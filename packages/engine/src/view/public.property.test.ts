// The hidden-information boundary over many random games (design doc 3.1, 3.2, 3.3, 3.6, 3.8).
// Twin games share all public data but have different hidden mine layouts that are consistent
// with the revealed numbers; a client must not be able to tell them apart.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { moveToUci } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { KING_STEPS } from "../chess/attacks";
import { offsetSquare } from "../chess/square";
import type { Color, Square } from "../chess/types";
import { DEFAULT_CONFIG } from "../mines/config";
import { revealedNumbers } from "../mines/numbers";
import { resolveMove } from "../mines/resolve";
import { createSeededRng, type Rng } from "../mines/rng";
import { createGame } from "../mines/setup";
import type { GameState } from "../mines/state";
import { legalMovesFromView } from "./client";
import { toGameOverView } from "./gameover";
import { projectEvents, toPublicView } from "./public";

const FORBIDDEN = ["hidden", "mines", "safeStart", "chainCaptured", "MineRelocated"];
const VIEWERS: (Color | null)[] = ["w", "b", null];

/** Key of the revealed squares next to `square`; equal keys mean identical revealed numbers. */
function revealedNeighbours(state: GameState, square: Square): string {
  const found: Square[] = [];
  for (const [df, dr] of KING_STEPS) {
    const neighbour = offsetSquare(square, df, dr);
    if (neighbour !== null && state.public.revealed.has(neighbour)) found.push(neighbour);
  }
  return found.sort((a, b) => a - b).join(",");
}

/**
 * Same public data, different hidden layout: each mine moves to a free, unrevealed,
 * non-crater square that touches the same revealed squares, so every revealed number stays
 * identical. The secret bookkeeping flags are flipped too.
 */
function twin(state: GameState, rng: Rng): GameState {
  const mines = new Set(state.hidden.mines);
  for (const mine of [...mines]) {
    const wanted = revealedNeighbours(state, mine);
    const candidates: Square[] = [];
    state.position.board.forEach((piece, square) => {
      if (
        piece === null &&
        !mines.has(square) &&
        !state.public.revealed.has(square) &&
        !state.public.craters.has(square) &&
        revealedNeighbours(state, square) === wanted
      ) {
        candidates.push(square);
      }
    });
    const to = candidates[rng.nextInt(Math.max(candidates.length, 1))];
    if (to !== undefined) {
      mines.delete(mine);
      mines.add(to);
    }
  }
  return {
    ...state,
    hidden: {
      mines,
      safeStart: { w: !state.hidden.safeStart.w, b: !state.hidden.safeStart.b },
      chainCaptured: !state.hidden.chainCaptured,
    },
  };
}

const sortedNumbers = (state: GameState) => [...revealedNumbers(state)].sort((a, b) => a[0] - b[0]);

function keysOf(value: unknown, keys = new Set<string>()): Set<string> {
  if (typeof value !== "object" || value === null) return keys;
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, keys);
  } else {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      keysOf(child, keys);
    }
  }
  return keys;
}

interface Tally {
  states: number;
  differentLayouts: number;
  withNumbers: number;
  gameOvers: number;
}

/** Plays random moves at high mine density, calling `visit` on every state reached. */
function walk(seed: number, choices: readonly number[], visit: (state: GameState) => void): void {
  const rng = createSeededRng(seed);
  let state = createGame({ rng, config: { ...DEFAULT_CONFIG, mineDensity: 0.5 } });
  visit(state);
  for (const choice of choices) {
    if (state.public.status.kind === "over") break;
    const moves = legalMoves(state.position);
    const move = moves[choice % moves.length];
    if (move === undefined) break;
    state = resolveMove(state, move, rng).state;
    visit(state);
  }
}

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const choicesArb = fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 60 });

describe("projection property tests", () => {
  // 3.2, 3.3: byte-identical projected JSON for games that differ only in hidden mines.
  it("gives identical views for twin games with different hidden layouts", () => {
    const tally: Tally = { states: 0, differentLayouts: 0, withNumbers: 0, gameOvers: 0 };
    fc.assert(
      fc.property(seedArb, choicesArb, seedArb, (seed, choices, twinSeed) => {
        walk(seed, choices, (state) => {
          const other = twin(state, createSeededRng(twinSeed));
          // Precondition of the twin: the revealed numbers really are identical.
          expect(sortedNumbers(other)).toEqual(sortedNumbers(state));
          expect(other.hidden.mines.size).toBe(state.hidden.mines.size);

          tally.states += 1;
          const differ = [...state.hidden.mines].some((m) => !other.hidden.mines.has(m));
          if (differ) tally.differentLayouts += 1;
          if (state.public.revealed.size > 0) tally.withNumbers += 1;

          for (const viewer of VIEWERS) {
            expect(JSON.stringify(toPublicView(other, viewer))).toBe(
              JSON.stringify(toPublicView(state, viewer)),
            );
          }
          // 3.6: after the game ends the only difference is the mine layout itself.
          const over = toGameOverView(state, "w");
          const overOther = toGameOverView(other, "w");
          expect(over === null).toBe(overOther === null);
          if (over !== null && overOther !== null) {
            tally.gameOvers += 1;
            expect(JSON.stringify(overOther.view)).toBe(JSON.stringify(over.view));
            expect(overOther.mines.length).toBe(over.mines.length);
          }
        });
      }),
      { numRuns: 150, seed: 20261016 },
    );
    // Not vacuous: layouts really differ, and the cases include revealed numbers.
    expect(tally.differentLayouts).toBeGreaterThan(100);
    expect(tally.withNumbers).toBeGreaterThan(100);
  });

  // 3.2: nothing secret appears in a view, in the log, or in projected events.
  it("never exposes hidden fields or server-only events", () => {
    fc.assert(
      fc.property(seedArb, choicesArb, (seed, choices) => {
        const rng = createSeededRng(seed);
        let state = createGame({ rng, config: { ...DEFAULT_CONFIG, mineDensity: 0.5 } });
        for (const choice of choices) {
          if (state.public.status.kind === "over") break;
          const moves = legalMoves(state.position);
          const move = moves[choice % moves.length];
          if (move === undefined) break;
          const result = resolveMove(state, move, rng);
          state = result.state;
          const projected = projectEvents(result.events);
          const view = toPublicView(state, null);
          for (const value of [projected, view]) {
            const keys = keysOf(value);
            for (const name of FORBIDDEN) expect(keys.has(name)).toBe(false);
            expect(JSON.stringify(value)).not.toContain("MineRelocated");
          }
          // 3.6: a game-over view appears exactly when the game has ended.
          expect(toGameOverView(state, null) !== null).toBe(state.public.status.kind === "over");
        }
      }),
      { numRuns: 150, seed: 20261016 },
    );
  });

  // 3.8 step 1: legality ignores mines, so the view alone gives the engine's legal moves.
  it("lets a client compute legal moves from the view alone", () => {
    fc.assert(
      fc.property(seedArb, choicesArb, (seed, choices) => {
        walk(seed, choices, (state) => {
          const fromView = legalMovesFromView(toPublicView(state, null)).map(moveToUci).sort();
          const expected =
            state.public.status.kind === "over"
              ? []
              : legalMoves(state.position).map(moveToUci).sort();
          expect(fromView).toEqual(expected);
        });
      }),
      { numRuns: 100, seed: 20261016 },
    );
  });
});
