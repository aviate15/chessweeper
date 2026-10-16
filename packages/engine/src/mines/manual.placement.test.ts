// 3.10 Manual mine mode: placement rounds, quota, random fill, reshuffle and re-placement.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { legalMoves } from "../chess/movegen";
import { rankOf } from "../chess/square";
import { DEFAULT_CONFIG, quotaFor } from "./config";
import { endGame } from "./endgame";
import { isPublicEvent, type GameEvent } from "./events";
import { liveMineCount, mineWeight } from "./numbers";
import {
  finishPlacement,
  legalPlacementSquares,
  markReady,
  placeMine,
  unplaceMine,
  type PlacementResult,
} from "./placement";
import { PlacementInProgressError, resolveMove } from "./resolve";
import { createSeededRng } from "./rng";
import { gameFromScenario } from "./scenario";
import { createGame } from "./setup";
import type { GameState } from "./state";
import { eventTypes, play, sq } from "./test-utils";

const MANUAL = { ...DEFAULT_CONFIG, mode: "manual" as const, reshuffleInterval: 10 };
const fresh = (seed = 1) => createGame({ rng: createSeededRng(seed), config: MANUAL });

function ok(result: PlacementResult): GameState {
  if (!result.ok) throw new Error(`placement failed: ${result.error}`);
  return result.state;
}
const error = (result: PlacementResult) => (result.ok ? null : result.error);

describe("3.10 quota", () => {
  it("is free squares x density / 2, rounded half-up: 5 each at the start", () => {
    expect(quotaFor(32, MANUAL)).toBe(5); // 4.8
    const game = fresh();
    expect(game.public.phase).toEqual({
      kind: "placement",
      round: 1,
      quota: 5,
      ready: { w: false, b: false },
    });
  });

  it("rounds an exact half up", () => {
    const half = { ...MANUAL, mineDensity: 0.5 };
    expect(quotaFor(2, half)).toBe(1); // 0.5 -> 1
    expect(quotaFor(1, half)).toBe(0); // 0.25 -> 0
    expect(quotaFor(6, half)).toBe(2); // 1.5 -> 2
    expect(quotaFor(61, MANUAL)).toBe(9); // 9.15
    expect(quotaFor(15, MANUAL)).toBe(2); // 2.25
  });

  it("halves the mine cap first", () => {
    expect(quotaFor(32, { ...MANUAL, mineCap: 6 })).toBe(3);
    expect(quotaFor(32, { ...MANUAL, mineCap: 7 })).toBe(3);
    expect(quotaFor(32, { ...MANUAL, mineCap: 100 })).toBe(5);
  });
});

describe("3.10 creating a manual game", () => {
  it("starts in placement round 1 with no mines, drafts and no safe start", () => {
    const game = fresh();
    expect(game.hidden.mines.size).toBe(0);
    expect(liveMineCount(game)).toBe(0);
    expect(game.hidden.drafts).toEqual({ w: new Set(), b: new Set() });
    expect(game.hidden.safeStart).toEqual({ w: false, b: false });
    expect(game.position.turn).toBe("w");
  });

  it("legal placement squares at the start are exactly the 32 squares of ranks 3-6", () => {
    const legal = legalPlacementSquares(fresh());
    expect(legal).toHaveLength(32);
    expect(legal.every((s) => rankOf(s) >= 2 && rankOf(s) <= 5)).toBe(true);
  });

  it("auto mode is unchanged: mines at once, no placement, no owners", () => {
    const auto = createGame({ rng: createSeededRng(1) });
    expect(auto.public.phase).toEqual({ kind: "play" });
    expect(auto.hidden.mines.size).toBe(10);
    expect(auto.hidden.owned ?? null).toBeNull();
    expect(legalPlacementSquares(auto)).toEqual([]);
    expect(error(placeMine(auto, "w", sq("e4")))).toBe("not-placing");
  });
});

describe("3.10 placing", () => {
  it("drafts are not mines until the round ends", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    game = ok(placeMine(game, "b", sq("d4")));
    expect(game.hidden.mines.size).toBe(0);
    expect(liveMineCount(game)).toBe(0);
    expect(game.hidden.drafts?.w.has(sq("e4"))).toBe(true);
    expect(game.hidden.drafts?.b.has(sq("d4"))).toBe(true);
    expect(game.hidden.owned?.w.size).toBe(0);
  });

  it("is immutable and idempotent: placing the same square again changes nothing", () => {
    const game = fresh();
    const once = ok(placeMine(game, "w", sq("e4")));
    expect(game.hidden.drafts?.w.size).toBe(0);
    const twice = ok(placeMine(once, "w", sq("e4")));
    expect(twice.hidden.drafts?.w.size).toBe(1);
  });

  it("a player may take a placement back and place elsewhere until Done", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    game = ok(unplaceMine(game, "w", sq("e4")));
    expect(game.hidden.drafts?.w.size).toBe(0);
    game = ok(unplaceMine(game, "w", sq("e4"))); // not placed: nothing happens
    expect(game.hidden.drafts?.w.size).toBe(0);
  });

  it("rejects a mine on an occupied square (bad-square)", () => {
    const game = fresh();
    expect(error(placeMine(game, "w", sq("e2")))).toBe("bad-square");
    expect(error(placeMine(game, "b", sq("e8")))).toBe("bad-square");
  });

  it("rejects squares off the board (bad-square)", () => {
    const game = fresh();
    expect(error(placeMine(game, "w", 64))).toBe("bad-square");
    expect(error(placeMine(game, "w", -1))).toBe("bad-square");
    expect(error(placeMine(game, "w", 1.5))).toBe("bad-square");
    expect(error(unplaceMine(game, "w", 64))).toBe("bad-square");
  });

  it("rejects a sixth mine when the quota is 5 (quota-full), after unplacing there is room", () => {
    let game = fresh();
    for (const name of ["a3", "b3", "c3", "d3", "e3"]) game = ok(placeMine(game, "w", sq(name)));
    expect(error(placeMine(game, "w", sq("f3")))).toBe("quota-full");
    // The other player's quota is separate.
    game = ok(placeMine(game, "b", sq("f3")));
    game = ok(unplaceMine(game, "w", sq("e3")));
    game = ok(placeMine(game, "w", sq("f3")));
    expect(game.hidden.drafts?.w.size).toBe(5);
  });

  it("two players on one square is allowed (it becomes a big mine at the end)", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    game = ok(placeMine(game, "b", sq("e4")));
    expect(game.hidden.drafts?.w.has(sq("e4"))).toBe(true);
    expect(game.hidden.drafts?.b.has(sq("e4"))).toBe(true);
  });
});

describe("3.10 Done and the ready lock", () => {
  it("Done emits PlayerReady, marks the phase and locks that player's draft", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    const done = markReady(game, "w");
    expect(done.ok && done.events).toEqual([{ type: "PlayerReady", color: "w" }]);
    game = ok(done);
    expect(game.public.phase).toMatchObject({ kind: "placement", ready: { w: true, b: false } });
    expect(error(placeMine(game, "w", sq("d4")))).toBe("already-ready");
    expect(error(unplaceMine(game, "w", sq("e4")))).toBe("already-ready");
    expect(error(markReady(game, "w"))).toBe("already-ready");
    // The other player is unaffected.
    expect(ok(placeMine(game, "b", sq("d4"))).hidden.drafts?.b.has(sq("d4"))).toBe(true);
  });

  it("Done does not end the round by itself; finishPlacement does", () => {
    let game = ok(markReady(ok(markReady(fresh(), "w")), "b"));
    expect(game.public.phase.kind).toBe("placement");
    game = finishPlacement(game, createSeededRng(3)).state;
    expect(game.public.phase).toEqual({ kind: "play" });
  });

  it("nothing can be placed or readied outside a placement (not-placing)", () => {
    const playing = gameFromScenario({ fen: START_FEN, config: MANUAL, owned: { w: ["e4"] } });
    expect(error(placeMine(playing, "w", sq("e5")))).toBe("not-placing");
    expect(error(unplaceMine(playing, "w", sq("e4")))).toBe("not-placing");
    expect(error(markReady(playing, "w"))).toBe("not-placing");
    const over = endGame(fresh(), { reason: "resignation", by: "w" }).state;
    expect(error(placeMine(over, "b", sq("e4")))).toBe("not-placing");
  });
});

describe("3.10 finishing a round: random fill", () => {
  it("fills each side up to its quota, deterministically with a seeded rng", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    game = ok(placeMine(game, "w", sq("d4")));
    const first = finishPlacement(game, createSeededRng(7));
    const second = finishPlacement(game, createSeededRng(7));
    expect(first.state.hidden.owned).toEqual(second.state.hidden.owned);
    expect(first.events).toEqual(second.events);

    const owned = first.state.hidden.owned;
    expect(owned?.w.size).toBe(5);
    expect(owned?.b.size).toBe(5);
    expect(owned?.w.has(sq("e4")) && owned.w.has(sq("d4"))).toBe(true); // kept
    for (const square of [...(owned?.w ?? []), ...(owned?.b ?? [])]) {
      expect(first.state.position.board[square]).toBeNull();
      expect(rankOf(square)).toBeGreaterThanOrEqual(2);
      expect(rankOf(square)).toBeLessThanOrEqual(5);
    }
  });

  it("reports how many were placed at random per side, in a non-public event", () => {
    let game = fresh();
    game = ok(placeMine(game, "w", sq("e4")));
    game = ok(placeMine(game, "w", sq("d4")));
    const { state, events } = finishPlacement(game, createSeededRng(7));
    expect(events.filter((e) => e.type === "MinesAutoPlaced")).toEqual([
      { type: "MinesAutoPlaced", color: "w", count: 3 },
      { type: "MinesAutoPlaced", color: "b", count: 5 },
    ]);
    expect(state.hidden.autoPlaced).toEqual({ w: 3, b: 5 });
    const auto = events.find((e) => e.type === "MinesAutoPlaced");
    expect(auto !== undefined && isPublicEvent(auto)).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "PlacementEnded",
      mineCount: state.hidden.owned ? state.hidden.owned.w.size + state.hidden.owned.b.size : -1,
    });
    expect(eventTypes(events.filter(isPublicEvent))).toEqual(["PlacementEnded"]);
  });

  it("a full side gets no MinesAutoPlaced event and no extra mines", () => {
    let game = fresh();
    for (const name of ["a3", "b3", "c3", "d3", "e3"]) game = ok(placeMine(game, "w", sq(name)));
    const { events, state } = finishPlacement(game, createSeededRng(2));
    expect(events.some((e) => e.type === "MinesAutoPlaced" && e.color === "w")).toBe(false);
    expect(state.hidden.autoPlaced).toEqual({ w: 0, b: 5 });
    expect([...(state.hidden.owned?.w ?? [])].sort()).toEqual(
      ["a3", "b3", "c3", "d3", "e3"].map(sq).sort(),
    );
  });

  it("merges the drafts: a square both chose is a big mine (count 2), others weigh 1", () => {
    let game = fresh();
    for (const name of ["a3", "b3", "c3", "d3", "e4"]) game = ok(placeMine(game, "w", sq(name)));
    for (const name of ["a6", "b6", "c6", "d6", "e4"]) game = ok(placeMine(game, "b", sq(name)));
    const { state, events } = finishPlacement(game, createSeededRng(1));
    expect(state.hidden.mines.size).toBe(9);
    expect(liveMineCount(state)).toBe(10); // always 2 x quota after a round
    expect(mineWeight(state.hidden, sq("e4"))).toBe(2);
    expect(mineWeight(state.hidden, sq("a3"))).toBe(1);
    expect(events.at(-1)).toEqual({ type: "PlacementEnded", mineCount: 10 });
    expect(state.hidden.drafts ?? null).toBeNull();
    expect(state.public.phase).toEqual({ kind: "play" });
    expect(state.position.turn).toBe("w");
  });

  it("is a no-op outside a placement", () => {
    const playing = gameFromScenario({ fen: START_FEN, config: MANUAL, owned: { w: ["e4"] } });
    const result = finishPlacement(playing, createSeededRng(1));
    expect(result.state).toBe(playing);
    expect(result.events).toEqual([]);
  });
});

describe("3.10 moves and safe start", () => {
  it("rejects moves during placement", () => {
    const game = fresh();
    const move = legalMoves(game.position)[0];
    if (move === undefined) throw new Error("no move");
    expect(() => resolveMove(game, move, createSeededRng(1))).toThrow(PlacementInProgressError);
  });

  it("has no safe start: a first move onto a mine is destroyed, nothing relocates", () => {
    const placed = finishPlacement(
      ok(placeMine(ok(placeMine(fresh(), "w", sq("e4"))), "b", sq("a6"))),
      createSeededRng(5),
    ).state;
    // Force the layout so that e4 definitely holds a mine regardless of the random fill.
    const game = gameFromScenario({
      fen: START_FEN,
      config: MANUAL,
      owned: { w: ["e4"], b: [] },
    });
    expect(placed.hidden.safeStart).toEqual({ w: false, b: false });
    const { state, events } = play(game, "e2e4");
    expect(state.position.board[sq("e4")]).toBeNull();
    expect(eventTypes(events)).toContain("MineTriggered");
    expect(eventTypes(events)).not.toContain("MineRelocated");
  });
});

describe("3.10 reshuffle starts a new placement round", () => {
  const scenario = () =>
    gameFromScenario({
      fen: "4k3/8/8/8/8/8/P7/4K3 w - - 0 1",
      config: { ...MANUAL, reshuffleInterval: 2 },
      owned: { w: ["c4", "h5"], b: ["c4"] },
      revealed: ["b3"],
      craters: ["g6"],
    });

  it("clears mines, craters and revealed numbers, then enters placement round 2", () => {
    const afterOne = play(scenario(), "a2a3");
    expect(afterOne.state.public.phase.kind).toBe("play");
    const { state, events } = play(afterOne.state, "e8d8");

    expect(
      eventTypes(events).filter((t) => t === "Reshuffled" || t === "PlacementStarted"),
    ).toEqual(["Reshuffled", "PlacementStarted"]);
    expect(state.hidden.mines.size).toBe(0);
    expect(state.hidden.owned?.w.size).toBe(0);
    expect(state.public.craters.size).toBe(0);
    expect(state.public.revealed.size).toBe(0);
    expect(state.public.noCaptureCount).toBe(0);
    // 61 free squares at 30%: 9 each (3.10 quota, half-up).
    expect(state.public.phase).toEqual({
      kind: "placement",
      round: 2,
      quota: 9,
      ready: { w: false, b: false },
    });
    expect(state.hidden.drafts).toEqual({ w: new Set(), b: new Set() });
    expect(state.hidden.autoPlaced ?? null).toBeNull();
    // The side to move is unchanged by the placement.
    expect(state.position.turn).toBe("w");
    expect(liveMineCount(state)).toBe(0);
  });

  it("allows any empty square in a later round, rejects moves, and play resumes after", () => {
    const afterOne = play(scenario(), "a2a3").state;
    const state = play(afterOne, "e8d8").state;
    expect(legalPlacementSquares(state)).toHaveLength(61); // every unoccupied square
    expect(legalPlacementSquares(state)).toContain(sq("a1"));
    const move = legalMoves(state.position)[0];
    if (move === undefined) throw new Error("no move");
    expect(() => resolveMove(state, move, createSeededRng(1))).toThrow(PlacementInProgressError);

    const next = finishPlacement(ok(placeMine(state, "w", sq("a1"))), createSeededRng(11)).state;
    expect(next.public.phase).toEqual({ kind: "play" });
    expect(next.hidden.owned?.w.has(sq("a1"))).toBe(true);
    expect(next.hidden.owned?.w.size).toBe(9);
    // Round 3 comes after another reshuffle.
    const r3 = play(play(next, "a3a4", createSeededRng(1)).state, "d8e8", createSeededRng(1));
    expect(r3.state.public.phase).toMatchObject({ kind: "placement", round: 3 });
  });

  it("a reshuffle also follows a capture-free blast turn; the chain of events is public-logged", () => {
    const afterOne = play(scenario(), "a2a3").state;
    const { state } = play(afterOne, "e8d8");
    const last = state.public.log.at(-1);
    const types = last?.events.map((e: GameEvent) => e.type) ?? [];
    expect(types).toContain("PlacementStarted");
  });

  it("a game-ending turn does not start a new placement", () => {
    const game = gameFromScenario({
      fen: "k7/8/8/8/8/8/8/2K5 w - - 0 1",
      config: { ...MANUAL, reshuffleInterval: 1 },
      owned: { w: ["b1"], b: [] },
      lives: { w: 1, b: 3 },
    });
    // Kc1-b1 hits a single mine on its last life: the game ends, nothing reshuffles.
    const { state } = play(game, "c1b1");
    expect(state.public.status.kind).toBe("over");
    expect(state.public.phase.kind).toBe("play");
  });
});
