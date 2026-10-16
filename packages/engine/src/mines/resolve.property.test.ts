// Invariants of the mine rules over many random games (design doc 3.1-3.6, 3.8).
// Two generators: games from the start position at high mine density, and mid-game
// positions (random plain-chess prelude) sprinkled with mines, which force king hits,
// check exceptions and game ends far more often than random play from the start.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isInCheck } from "../chess/attacks";
import { applyMove } from "../chess/apply";
import { START_FEN, toFen } from "../chess/fen";
import { legalMoves } from "../chess/movegen";
import { parseFen } from "../chess/fen";
import { fileOf, rankOf, squareName } from "../chess/square";
import { DEFAULT_CONFIG } from "./config";
import { revealedNumbers } from "./numbers";
import { GameOverError, resolveMove } from "./resolve";
import { createSeededRng, pickDistinct } from "./rng";
import { gameFromScenario } from "./scenario";
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

const sorted = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b);

const snapshot = (s: GameState) =>
  JSON.stringify([
    s.position,
    sorted(s.hidden.mines),
    sorted(s.public.craters),
    sorted(s.public.revealed),
    s.public.lives,
    s.public.status,
    s.public.checkException,
  ]);

function checkInvariants(state: GameState, initialMines: number): void {
  // 3.1, 3.5: no mine is ever under a piece in a live game. The one exception is a castle
  // whose king dies on its landing: the game is over, so the rook landing never resolves
  // (3.6) and the rook may stand on a still-live mine.
  if (state.public.status.kind === "ongoing") {
    for (const mine of state.hidden.mines) expect(state.position.board[mine]).toBeNull();
  }
  // A square is a live mine, a crater, or neither; revealed squares never hold a mine.
  for (const crater of state.public.craters) expect(state.hidden.mines.has(crater)).toBe(false);
  for (const square of state.public.revealed) expect(state.hidden.mines.has(square)).toBe(false);
  // Mines are conserved until the reshuffle exists: each is either live or a crater.
  expect(state.hidden.mines.size + state.public.craters.size).toBe(initialMines);
  // 3.6: lives stay within 0..3.
  const { w, b } = state.public.lives;
  for (const lives of [w, b]) {
    expect(lives).toBeGreaterThanOrEqual(0);
    expect(lives).toBeLessThanOrEqual(3);
  }
  // 3.2: live numbers match a brute-force recount.
  for (const [square, number] of revealedNumbers(state)) {
    expect(number).toBe(bruteForceCount(state, square));
  }

  const moves = legalMoves(state.position);
  const { status, checkException } = state.public;
  if (w === 0 || b === 0) {
    // 3.6: a king at 0 lives always ends the game, and that king's side loses.
    expect(status).toEqual({ kind: "over", result: w === 0 ? "b" : "w", reason: "king-lives" });
  } else if (moves.length === 0) {
    // 3.6: no legal move means checkmate (the side to move loses) or stalemate (a draw).
    expect(status.kind).toBe("over");
    const check = isInCheck(state.position);
    expect(status).toEqual(
      check
        ? { kind: "over", result: state.position.turn === "w" ? "b" : "w", reason: "checkmate" }
        : { kind: "over", result: "draw", reason: "stalemate" },
    );
  } else {
    expect(status.kind).toBe("ongoing");
  }
  // 3.4: a pending check exception means the same side must move again, in check, with a
  // way out.
  if (checkException !== null) {
    expect(status.kind).toBe("ongoing");
    expect(state.position.turn).toBe(checkException);
    expect(isInCheck(state.position, checkException)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  }
  // 3.6: no moves are accepted after the game is over.
  const first = moves[0];
  if (status.kind === "over" && first !== undefined) {
    expect(() => resolveMove(state, first, createSeededRng(1))).toThrow(GameOverError);
  }
}

interface Tally {
  explosions: number;
  lifeLost: number;
  checkExceptions: number;
  kingDeaths: number;
  checkmates: number;
}

/** Plays up to `choices.length` random moves, checking the invariants after each. */
function playRandomly(start: GameState, choices: readonly number[], tally: Tally): void {
  let expectedMines = start.hidden.mines.size + start.public.craters.size;
  let state = start;
  checkInvariants(state, expectedMines);

  for (const choice of choices) {
    if (state.public.status.kind === "over") break;
    const moves = legalMoves(state.position);
    const move = moves[choice % moves.length];
    if (move === undefined) break;

    const before = snapshot(state);
    const fullmoveBefore = state.position.fullmoveNumber;
    const result = resolveMove(state, move, createSeededRng(1));
    expect(snapshot(state)).toBe(before); // inputs are never mutated
    state = result.state;
    // A reshuffle starts a fresh mine population (3.7); the formula is checked in commit 5.
    if (result.events.some((e) => e.type === "Reshuffled")) {
      expectedMines = state.hidden.mines.size + state.public.craters.size;
    }

    for (const event of result.events) {
      if (event.type === "PieceDestroyed") tally.explosions += 1;
      if (event.type === "LifeLost") tally.lifeLost += 1;
      if (event.type === "CheckExceptionTriggered") tally.checkExceptions += 1;
      if (event.type === "GameOver" && event.reason === "king-lives") tally.kingDeaths += 1;
      if (event.type === "GameOver" && event.reason === "checkmate") tally.checkmates += 1;
    }
    // A whole check-exception chain is one turn: the fullmove number advances at most once.
    expect(state.position.fullmoveNumber - fullmoveBefore).toBeLessThanOrEqual(1);
    checkInvariants(state, expectedMines);
  }
}

const emptyTally = (): Tally => ({
  explosions: 0,
  lifeLost: 0,
  checkExceptions: 0,
  kingDeaths: 0,
  checkmates: 0,
});

// Seeds are pinned so CI is reproducible (and the non-vacuity checks below are stable).
// To explore, change the seed or raise numRuns temporarily; a failing run prints a
// counterexample to replay.
const choicesArb = fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 80 });
const seedArb = fc.integer({ min: 0, max: 0xffffffff });

describe("mine invariants over random games", () => {
  it("hold in games from the start position at high mine density", () => {
    const tally = emptyTally();
    fc.assert(
      fc.property(seedArb, choicesArb, (seed, choices) => {
        const config = { ...DEFAULT_CONFIG, mineDensity: 0.7 };
        playRandomly(createGame({ rng: createSeededRng(seed), config }), choices, tally);
      }),
      { numRuns: 200, seed: 20261016 },
    );
    expect(tally.explosions).toBeGreaterThan(0);
  });

  it("hold in mid-game positions sprinkled with mines (forces king hits and check exceptions)", () => {
    const tally = emptyTally();
    fc.assert(
      fc.property(
        seedArb,
        fc.nat({ max: 40 }),
        fc.integer({ min: 2, max: 9 }),
        fc.tuple(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 3 })),
        choicesArb,
        (seed, prelude, density, [whiteLives, blackLives], choices) => {
          // Plain-chess prelude without mines, then mines on random empty squares.
          let position = parseFen(START_FEN);
          const rng = createSeededRng(seed);
          for (let i = 0; i < prelude; i++) {
            const moves = legalMoves(position);
            const move = moves[rng.nextInt(moves.length)];
            if (move === undefined) break;
            position = applyMove(position, move);
          }
          if (legalMoves(position).length === 0) return; // prelude ended the game
          const empty = position.board.flatMap((p, s) => (p === null ? [s] : []));
          const mines = pickDistinct(rng, empty, Math.round((density / 10) * empty.length));
          const game = gameFromScenario({
            fen: toFen(position),
            mines: mines.map(squareName),
            lives: { w: whiteLives, b: blackLives },
          });
          playRandomly(game, choices, tally);
        },
      ),
      { numRuns: 400, seed: 20261016 },
    );
    // Make sure the generator really reaches the interesting cases.
    expect(tally.explosions).toBeGreaterThan(0);
    expect(tally.lifeLost).toBeGreaterThan(0);
    expect(tally.checkExceptions).toBeGreaterThan(0);
    expect(tally.kingDeaths).toBeGreaterThan(0);
  });
});
