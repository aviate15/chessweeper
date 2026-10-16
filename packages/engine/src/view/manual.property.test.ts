// Manual mine mode (design doc 3.10) privacy: who placed a mine, a player's placements and
// whether a mine is a stack are hidden information. Twin games share every public datum but
// differ in exactly that secret; no client may be able to tell them apart (3.2, 3.10).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { KING_STEPS } from "../chess/attacks";
import { START_FEN } from "../chess/fen";
import { legalMoves } from "../chess/movegen";
import { offsetSquare } from "../chess/square";
import type { Color, Square } from "../chess/types";
import { opponent } from "../chess/types";
import { DEFAULT_CONFIG, type GameConfig } from "../mines/config";
import { endGame } from "../mines/endgame";
import type { GameEvent } from "../mines/events";
import { liveMineCount, revealedNumbers } from "../mines/numbers";
import {
  finishPlacement,
  legalPlacementSquares,
  markReady,
  placeMine,
  unplaceMine,
} from "../mines/placement";
import { PlacementInProgressError, resolveMove } from "../mines/resolve";
import { createSeededRng } from "../mines/rng";
import { gameFromScenario } from "../mines/scenario";
import { createGame } from "../mines/setup";
import type { GameState } from "../mines/state";
import { phaseOf } from "./client";
import { toSafeError } from "./errors";
import { toGameOverView } from "./gameover";
import { projectEvents, toPublicView } from "./public";

const MANUAL: GameConfig = {
  ...DEFAULT_CONFIG,
  mode: "manual",
  mineDensity: 0.5,
  reshuffleInterval: 3,
  kingLives: 2,
};
const VIEWERS: (Color | null)[] = ["w", "b", null];
// Keys that must never appear in any projection a client receives.
const FORBIDDEN = [
  "hidden",
  "mines",
  "safeStart",
  "chainCaptured",
  "MineRelocated",
  "owned",
  "drafts",
  "autoPlaced",
  "MinesAutoPlaced",
];

const sorted = (set: Iterable<Square>) => [...set].sort((a, b) => a - b);
const json = (value: unknown) => JSON.stringify(value);

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

interface Step {
  readonly before: GameState;
  readonly after: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * One step of a random manual game. During placement `choice` drives one placement action
 * (a small square pool half of the time, so both players often pick the same square and
 * make stacks); in play it picks a legal move. Uses only the real engine functions.
 */
function advance(state: GameState, choice: number, rngSeed: number): Step | null {
  const rng = createSeededRng(rngSeed);
  if (state.public.status.kind === "over") return null;
  if (state.public.phase.kind === "placement") {
    const legal = legalPlacementSquares(state);
    const pool = (choice & 8) === 0 ? legal.slice(0, 10) : legal;
    const square = pool[(choice >> 4) % Math.max(pool.length, 1)] ?? 0;
    const color: Color = (choice & 1) === 0 ? "w" : "b";
    const action = (choice >> 1) % 7;
    let result;
    if (action <= 3) result = placeMine(state, color, square);
    else if (action === 4) result = unplaceMine(state, color, square);
    else result = markReady(state, color);
    let next = result.ok ? result.state : state;
    let events: readonly GameEvent[] = result.ok ? result.events : [];
    const phase = next.public.phase;
    if (phase.kind === "placement" && ((phase.ready.w && phase.ready.b) || choice % 11 === 0)) {
      const fin = finishPlacement(next, rng);
      next = fin.state;
      events = [...events, ...fin.events];
    }
    return { before: state, after: next, events };
  }
  const moves = legalMoves(state.position);
  const move = moves[choice % moves.length];
  if (move === undefined) return null;
  const resolution = resolveMove(state, move, rng);
  return { before: state, after: resolution.state, events: resolution.events };
}

const newGame = (seed: number) => createGame({ rng: createSeededRng(seed), config: MANUAL });

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const choicesArb = fc.array(fc.nat({ max: 5000 }), { minLength: 20, maxLength: 140 });

const swapOwners = (state: GameState): GameState => {
  const owned = state.hidden.owned;
  if (owned == null) return state;
  const autoPlaced = state.hidden.autoPlaced;
  return {
    ...state,
    hidden: {
      ...state.hidden,
      owned: { w: new Set(owned.b), b: new Set(owned.w) },
      autoPlaced: autoPlaced == null ? null : { w: autoPlaced.b, b: autoPlaced.w },
    },
  };
};

/** Flips the owner of the `index`-th single mine (sorted); stacks and mine squares are kept. */
const flipOne = (state: GameState, index: number): GameState => {
  const owned = state.hidden.owned;
  if (owned == null) return state;
  const singles = sorted(state.hidden.mines).filter((s) => !(owned.w.has(s) && owned.b.has(s)));
  const target = singles[index % Math.max(singles.length, 1)];
  if (target === undefined) return state;
  const w = new Set(owned.w);
  const b = new Set(owned.b);
  if (w.has(target)) {
    w.delete(target);
    b.add(target);
  } else {
    b.delete(target);
    w.add(target);
  }
  return { ...state, hidden: { ...state.hidden, owned: { w, b } } };
};

describe("manual mode: owner-swap twins (3.10: a mine never shows who placed it)", () => {
  const tally = { steps: 0, ownOwnMine: 0, ownerDiffers: 0, playSteps: 0, gameOvers: 0 };

  it("projects identical views and events when only the owners differ", () => {
    fc.assert(
      fc.property(
        seedArb,
        choicesArb,
        fc.option(fc.nat({ max: 50 }), { nil: undefined }),
        (seed, choices, flip) => {
          let a = newGame(seed);
          let b = a;
          let n = 0;
          for (const choice of choices) {
            const stepA = advance(a, choice, seed + n);
            if (stepA === null) break;
            const stepB = advance(b, choice, seed + n);
            if (stepB === null) break;
            n += 1;
            const wasPlacing = a.public.phase.kind === "placement";
            const mover = a.position.turn;
            const ownMine = new Set(a.hidden.owned?.[mover] ?? []);
            a = stepA.after;
            b = stepB.after;
            // The round just ended: from here the twin has the owners changed (or one flipped).
            if (wasPlacing && a.public.phase.kind === "play") {
              b = flip === undefined ? swapOwners(a) : flipOne(a, flip);
              if (json(sorted(b.hidden.owned?.w ?? [])) !== json(sorted(a.hidden.owned?.w ?? []))) {
                tally.ownerDiffers += 1;
              }
            }
            // The twins differ in nothing but the owners.
            expect(sorted(b.hidden.mines)).toEqual(sorted(a.hidden.mines));
            expect(liveMineCount(b)).toBe(liveMineCount(a));
            expect(sortedNumbers(b)).toEqual(sortedNumbers(a));

            tally.steps += 1;
            if (!wasPlacing) tally.playSteps += 1;
            for (const event of stepA.events) {
              if (event.type === "MineTriggered" && ownMine.has(event.square)) {
                tally.ownOwnMine += 1;
              }
            }
            for (const viewer of VIEWERS) {
              expect(json(toPublicView(b, viewer))).toBe(json(toPublicView(a, viewer)));
              expect(json(projectEvents(stepB.events, viewer))).toBe(
                json(projectEvents(stepA.events, viewer)),
              );
            }
            const overA = toGameOverView(a, "w");
            const overB = toGameOverView(b, "w");
            expect(overA === null).toBe(overB === null);
            if (overA !== null && overB !== null) {
              tally.gameOvers += 1;
              expect(json(overB.view)).toBe(json(overA.view));
              expect(overB.mines).toEqual(overA.mines);
            }
          }
        },
      ),
      { numRuns: 120, seed: 20261017 },
    );
    // Non-vacuous: owners really differ, play states are covered, a player hit their own mine.
    expect(tally.ownerDiffers).toBeGreaterThan(30);
    expect(tally.playSteps).toBeGreaterThan(300);
    expect(tally.ownOwnMine).toBeGreaterThan(5);
    expect(tally.gameOvers).toBeGreaterThan(0);
  });
});

function sortedNumbers(state: GameState) {
  return [...revealedNumbers(state)].sort((x, y) => x[0] - y[0]);
}

describe("manual mode: draft twins (3.10: opponent sees only placing/ready)", () => {
  const tally = { states: 0, ownVisible: 0, draftsDiffer: 0, autoPlacedSeen: 0 };

  /** `state` with `color`'s draft replaced by a different random subset of legal squares. */
  function withDraft(state: GameState, color: Color, other: readonly number[]): GameState {
    const quota = state.public.phase.kind === "placement" ? state.public.phase.quota : 0;
    const legal = legalPlacementSquares(state);
    const draft = new Set(other.map((i) => legal[i % legal.length] ?? 0).slice(0, quota));
    const drafts = state.hidden.drafts;
    if (drafts == null) return state;
    return {
      ...state,
      hidden: {
        ...state.hidden,
        drafts: color === "w" ? { w: draft, b: drafts.b } : { w: drafts.w, b: draft },
      },
    };
  }

  it("never lets one seat's drafts reach the other seat, a spectator or the log", () => {
    fc.assert(
      fc.property(
        seedArb,
        choicesArb,
        fc.array(fc.nat({ max: 63 }), { maxLength: 12 }),
        (seed, choices, other) => {
          let state = newGame(seed);
          let n = 0;
          for (const choice of choices) {
            const step = advance(state, choice, seed + n);
            if (step === null) break;
            n += 1;
            state = step.after;
            if (state.public.phase.kind !== "placement") continue;
            tally.states += 1;
            for (const x of ["w", "b"] as const) {
              const y = opponent(x);
              const twin = withDraft(state, y, other);
              const real = state.hidden.drafts?.[y] ?? new Set<number>();
              if (sorted(real).join() !== sorted(twin.hidden.drafts?.[y] ?? []).join()) {
                tally.draftsDiffer += 1;
              }
              // X's view and X's events cannot depend on Y's draft.
              expect(json(toPublicView(twin, x))).toBe(json(toPublicView(state, x)));
              // Nor can a spectator's view (which has no draft at all).
              expect(json(toPublicView(twin, null))).toBe(json(toPublicView(state, null)));
              // X sees their own draft, sorted; null never does.
              const own = toPublicView(state, x).placement?.own;
              expect(own).toEqual(sorted(state.hidden.drafts?.[x] ?? []));
              if ((own?.length ?? 0) > 0) tally.ownVisible += 1;
              expect(toPublicView(state, null).placement?.own).toBeNull();
            }
            // Finishing the round: X's events and view do not depend on Y's draft.
            for (const x of ["w", "b"] as const) {
              const twin = withDraft(state, opponent(x), other);
              const finA = finishPlacement(state, createSeededRng(seed));
              const finB = finishPlacement(twin, createSeededRng(seed));
              for (const viewer of VIEWERS) {
                expect(json(toPublicView(finB.state, viewer))).toBe(
                  json(toPublicView(finA.state, viewer)),
                );
              }
              // Events carry Y's count only if Y == viewer; X never sees Y's count.
              const evA = json(projectEvents(finA.events, x));
              const evB = json(projectEvents(finB.events, x));
              if (!finA.events.some((e) => e.type === "MinesAutoPlaced" && e.color === x)) {
                expect(evB).toBe(evA);
              }
              if (evA.includes("MinesAutoPlaced")) tally.autoPlacedSeen += 1;
              expect(json(projectEvents(finA.events, null))).not.toContain("MinesAutoPlaced");
              expect(json(projectEvents(finA.events, opponent(x)))).not.toContain(
                `"MinesAutoPlaced","color":"${x}"`,
              );
            }
          }
        },
      ),
      { numRuns: 120, seed: 20261017 },
    );
    expect(tally.states).toBeGreaterThan(100);
    expect(tally.ownVisible).toBeGreaterThan(30);
    expect(tally.draftsDiffer).toBeGreaterThan(30);
    expect(tally.autoPlacedSeen).toBeGreaterThan(10);
  });

  it("changing only X's draft leaves the opponent's and a spectator's view untouched", () => {
    const state = newGame(7);
    const a = placeMine(state, "w", 20);
    if (!a.ok) throw new Error("place failed");
    const b = placeMine(state, "w", 21);
    if (!b.ok) throw new Error("place failed");
    for (const viewer of ["b", null] as const) {
      expect(json(toPublicView(a.state, viewer))).toBe(json(toPublicView(b.state, viewer)));
    }
    expect(json(toPublicView(a.state, "w"))).not.toBe(json(toPublicView(b.state, "w")));
    expect(toPublicView(a.state, "w").placement?.own).toEqual([20]);
  });
});

describe("manual mode: nothing of a placement survives the round (3.10 memory skill)", () => {
  it("has no placement, owned, drafts or own keys in any play-phase view", () => {
    let seen = 0;
    fc.assert(
      fc.property(seedArb, choicesArb, (seed, choices) => {
        let state = newGame(seed);
        let n = 0;
        for (const choice of choices) {
          const step = advance(state, choice, seed + n);
          if (step === null) break;
          n += 1;
          state = step.after;
          if (state.public.phase.kind !== "play") continue;
          seen += 1;
          for (const viewer of VIEWERS) {
            const view = toPublicView(state, viewer);
            expect(view.placement).toBeNull();
            expect(view.phase).toEqual({ kind: "play" });
            const keys = keysOf(view);
            for (const name of [...FORBIDDEN, "own", "ready"]) {
              expect(keys.has(name)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 80, seed: 20261017 },
    );
    expect(seen).toBeGreaterThan(200);
  });

  it("drops a seat's own draft the moment the round ends", () => {
    let state = newGame(3);
    for (const sqr of [16, 17, 18]) {
      const r = placeMine(state, "w", sqr);
      if (r.ok) state = r.state;
    }
    expect(toPublicView(state, "w").placement?.own).toEqual([16, 17, 18]);
    state = finishPlacement(state, createSeededRng(1)).state;
    const view = toPublicView(state, "w");
    expect(view.placement).toBeNull();
    expect(json(view)).not.toContain('"own"');
  });
});

describe("manual mode: game over view (3.6, 3.10)", () => {
  it("is null while the game runs, then carries who placed each mine", () => {
    const tally = { checked: 0, over: 0 };
    fc.assert(
      fc.property(seedArb, choicesArb, fc.boolean(), (seed, choices, resign) => {
        let state = newGame(seed);
        let n = 0;
        for (const choice of choices) {
          const step = advance(state, choice, seed + n);
          if (step === null) break;
          n += 1;
          state = step.after;
          for (const viewer of VIEWERS) {
            expect(toGameOverView(state, viewer) === null).toBe(
              state.public.status.kind !== "over",
            );
          }
          tally.checked += 1;
        }
        if (resign && state.public.status.kind === "ongoing") {
          state = endGame(state, { reason: "resignation", by: "w" }).state;
        }
        if (state.public.status.kind !== "over") return;
        tally.over += 1;
        const owned = state.hidden.owned;
        for (const viewer of VIEWERS) {
          const over = toGameOverView(state, viewer);
          expect(over).not.toBeNull();
          expect(over?.owned).toEqual({ w: sorted(owned?.w ?? []), b: sorted(owned?.b ?? []) });
          expect(over?.mines).toEqual(sorted(state.hidden.mines));
          // `mines` is the union of both seats' lists, a stack listed once.
          expect(over?.mines).toEqual(
            sorted(new Set([...(over?.owned?.w ?? []), ...(over?.owned?.b ?? [])])),
          );
        }
        // The embedded view itself is still free of every secret.
        const keys = keysOf(toGameOverView(state, "b")?.view);
        for (const name of FORBIDDEN) expect(keys.has(name)).toBe(false);
      }),
      { numRuns: 100, seed: 20261017 },
    );
    expect(tally.over).toBeGreaterThan(20);
  });

  it("is null in Auto mode, and mines keeps its meaning", () => {
    const auto = endGame(createGame({ rng: createSeededRng(5) }), {
      reason: "resignation",
      by: "b",
    }).state;
    const over = toGameOverView(auto, null);
    expect(over?.owned).toBeNull();
    expect(over?.mines).toEqual(sorted(auto.hidden.mines));
  });

  it("resigning during placement reveals no drafts: no mines are live yet", () => {
    let state = newGame(9);
    const r = placeMine(state, "b", 30);
    if (r.ok) state = r.state;
    state = endGame(state, { reason: "resignation", by: "w" }).state;
    const over = toGameOverView(state, "w");
    expect(over?.mines).toEqual([]);
    expect(over?.owned).toEqual({ w: [], b: [] });
    expect(json(over)).not.toContain("30");
  });
});

describe("manual mode: forbidden key scan (3.2, 3.10)", () => {
  it("never exposes owned, drafts, autoPlaced or MinesAutoPlaced to the wrong audience", () => {
    const tally = { own: 0, events: 0 };
    fc.assert(
      fc.property(seedArb, choicesArb, (seed, choices) => {
        let state = newGame(seed);
        let n = 0;
        for (const choice of choices) {
          const step = advance(state, choice, seed + n);
          if (step === null) break;
          n += 1;
          state = step.after;
          for (const viewer of VIEWERS) {
            const view = toPublicView(state, viewer);
            const projected = projectEvents(step.events, viewer);
            tally.events += projected.length;
            for (const value of [view, projected]) {
              const keys = keysOf(value);
              for (const name of FORBIDDEN) {
                if (name === "MinesAutoPlaced") continue; // checked on the values below
                expect(keys.has(name)).toBe(false);
              }
              expect(json(value)).not.toContain("MineRelocated");
            }
            // The view never carries it, for anyone.
            expect(json(view)).not.toContain("MinesAutoPlaced");
            // Events carry it only for its own colour.
            for (const event of projected) {
              if (event.type === "MinesAutoPlaced") {
                expect(event.color).toBe(viewer);
                tally.own += 1;
              }
            }
            if (viewer === null) expect(json(projected)).not.toContain("MinesAutoPlaced");
          }
          // The other seat never gets the colour's event (checked against the engine truth).
          for (const event of step.events) {
            if (event.type !== "MinesAutoPlaced") continue;
            const other = projectEvents(step.events, opponent(event.color));
            expect(other.some((e) => e.type === "MinesAutoPlaced" && e.color === event.color)).toBe(
              false,
            );
          }
        }
      }),
      { numRuns: 120, seed: 20261017 },
    );
    expect(tally.own).toBeGreaterThan(10);
    expect(tally.events).toBeGreaterThan(500);
  });
});

describe("manual mode: a stack is indistinguishable from two separate mines (3.10)", () => {
  const tally = { stacks: 0, twins: 0 };

  function revealedNeighbours(state: GameState, square: Square): string {
    const found: Square[] = [];
    for (const [df, dr] of KING_STEPS) {
      const neighbour = offsetSquare(square, df, dr);
      if (neighbour !== null && state.public.revealed.has(neighbour)) found.push(neighbour);
    }
    return found.sort((x, y) => x - y).join(",");
  }

  /**
   * Splits each stack in two: one of the two mines moves to a free, unrevealed square that
   * touches the same revealed squares, so every revealed number and the mine count match.
   */
  function splitStacks(state: GameState, pick: number): GameState {
    const owned = state.hidden.owned;
    if (owned == null) return state;
    const w = new Set(owned.w);
    const b = new Set(owned.b);
    const mines = new Set(state.hidden.mines);
    for (const stack of sorted(mines).filter((s) => w.has(s) && b.has(s))) {
      const wanted = revealedNeighbours(state, stack);
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
      const to = candidates[pick % Math.max(candidates.length, 1)];
      if (to === undefined) continue;
      b.delete(stack);
      b.add(to);
      mines.add(to);
      tally.twins += 1;
    }
    return { ...state, hidden: { ...state.hidden, mines, owned: { w, b } } };
  }

  it("gives identical views for a stack and for the same mines split apart", () => {
    fc.assert(
      fc.property(seedArb, choicesArb, fc.nat({ max: 100 }), (seed, choices, pick) => {
        let state = newGame(seed);
        let n = 0;
        for (const choice of choices) {
          const step = advance(state, choice, seed + n);
          if (step === null) break;
          n += 1;
          state = step.after;
          const owned = state.hidden.owned;
          if (state.public.phase.kind !== "play" || owned == null) continue;
          const stacks = [...owned.w].filter((s) => owned.b.has(s) && state.hidden.mines.has(s));
          if (stacks.length === 0) continue;
          tally.stacks += 1;
          const twin = splitStacks(state, pick);
          // Preconditions of the twin: same revealed numbers, same live mine count.
          expect(sortedNumbers(twin)).toEqual(sortedNumbers(state));
          expect(liveMineCount(twin)).toBe(liveMineCount(state));
          for (const viewer of VIEWERS) {
            expect(json(toPublicView(twin, viewer))).toBe(json(toPublicView(state, viewer)));
          }
        }
      }),
      { numRuns: 120, seed: 20261017 },
    );
    expect(tally.stacks).toBeGreaterThan(30);
    expect(tally.twins).toBeGreaterThan(20);
  });

  it("counts a stack as 2 in the live mine count and in neighbouring numbers", () => {
    const base = {
      fen: START_FEN,
      config: MANUAL,
      revealed: ["d3"],
    };
    const stack = gameFromScenario({ ...base, owned: { w: ["e4"], b: ["e4"] } });
    const pair = gameFromScenario({ ...base, owned: { w: ["e4"], b: ["c4"] } });
    expect(toPublicView(stack, "w").mineCount).toBe(2);
    expect(toPublicView(pair, "w").mineCount).toBe(2);
    expect(toPublicView(stack, null).revealed).toEqual([{ square: 19, number: 2 }]);
    expect(toPublicView(pair, null).revealed).toEqual([{ square: 19, number: 2 }]);
    expect(json(toPublicView(stack, "b"))).toBe(json(toPublicView(pair, "b")));
  });
});

describe("manual mode: projection unit tests (3.10)", () => {
  const placing = gameFromScenario({
    fen: START_FEN,
    config: MANUAL,
    placement: { quota: 4, round: 2 },
  });

  it("PublicView.phase and placement describe the round, own only for the matching seat", () => {
    let state = placing;
    for (const [color, square] of [
      ["w", 20],
      ["w", 18],
      ["b", 30],
    ] as const) {
      const r = placeMine(state, color, square);
      if (r.ok) state = r.state;
    }
    const w = toPublicView(state, "w");
    expect(w.phase).toEqual({
      kind: "placement",
      round: 2,
      quota: 4,
      ready: { w: false, b: false },
    });
    expect(w.placement).toEqual({ quota: 4, ready: { w: false, b: false }, own: [18, 20] });
    expect(toPublicView(state, "b").placement?.own).toEqual([30]);
    expect(toPublicView(state, null).placement).toEqual({
      quota: 4,
      ready: { w: false, b: false },
      own: null,
    });
  });

  it("shows ready flags to both seats without any count or square", () => {
    const placed = placeMine(placing, "b", 30);
    if (!placed.ok) throw new Error("place failed");
    const ready = markReady(placed.state, "b");
    if (!ready.ok) throw new Error("ready failed");
    expect(toPublicView(ready.state, "w").placement).toEqual({
      quota: 4,
      ready: { w: false, b: true },
      own: [],
    });
    expect(json(toPublicView(ready.state, "w"))).not.toContain("30");
    expect(projectEvents(ready.events, "w")).toEqual([{ type: "PlayerReady", color: "b" }]);
  });

  it("settings carry the mode; Auto views keep the old settings shape, phase play, no placement", () => {
    expect(toPublicView(placing, "w").settings).toEqual({
      reshuffleInterval: 3,
      densityPercent: 50,
      mode: "manual",
    });
    const auto = toPublicView(createGame({ rng: createSeededRng(1) }), "w");
    expect(auto.settings).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
    expect(Object.keys(auto)).not.toContain("phase");
    expect(Object.keys(auto)).not.toContain("placement");
    expect(phaseOf(auto)).toEqual({ kind: "play" });
  });

  it("reads zero live mines and the full interval during placement", () => {
    const view = toPublicView(newGame(1), "w");
    expect(view.mineCount).toBe(0);
    // Pure function of the counter, which is 0 until play begins.
    expect(view.turnsUntilReshuffle).toBe(3);
  });

  it("projects the new public events field by field", () => {
    const events: GameEvent[] = [
      { type: "PlacementStarted", round: 2, quota: 7 },
      { type: "PlayerReady", color: "w" },
      { type: "PlacementEnded", mineCount: 14 },
      { type: "BigMineBlasted", square: 28, by: { color: "b", type: "n" }, area: [27, 28, 29] },
    ];
    expect(projectEvents(events)).toEqual(events);
  });

  it("MinesAutoPlaced goes only to its own colour", () => {
    const events: GameEvent[] = [{ type: "MinesAutoPlaced", color: "w", count: 3 }];
    expect(projectEvents(events, "w")).toEqual([{ type: "MinesAutoPlaced", color: "w", count: 3 }]);
    expect(projectEvents(events, "b")).toEqual([]);
    expect(projectEvents(events, null)).toEqual([]);
    expect(projectEvents(events)).toEqual([]);
  });

  it("maps a move during placement to a fixed safe error", () => {
    expect(toSafeError(new PlacementInProgressError())).toEqual({
      code: "not-playing",
      message: "Mines are being placed",
    });
    expect(() => {
      const move = legalMoves(placing.position)[0];
      if (move === undefined) throw new Error("no move");
      resolveMove(placing, move, createSeededRng(1));
    }).toThrow(PlacementInProgressError);
  });
});

describe("phaseOf (3.10)", () => {
  it("reads the phase of a Manual view and defaults an Auto view to play", () => {
    const manual = toPublicView(newGame(2), "w");
    expect(phaseOf(manual)).toEqual({
      kind: "placement",
      round: 1,
      quota: 8,
      ready: { w: false, b: false },
    });
    expect(phaseOf(toPublicView(createGame({ rng: createSeededRng(2) }), null))).toEqual({
      kind: "play",
    });
  });
});
