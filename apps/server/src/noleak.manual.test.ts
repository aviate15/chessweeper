import { afterEach, describe, expect, it } from "vitest";
import { createSeededRng, type GameSettings } from "@chessweeper/engine";
import { startHarness, twoPlayers, type Harness, type TestClient } from "./testkit";

/*
 * 3.10 information boundary, end to end over real websockets. Two rooms run with the same
 * seed where only one player's placements differ; the other player's frames must be
 * byte-identical (apart from the random room code and seat token), so nothing about the
 * opponent's squares or count can reach them. `owned` appears only in game_over.
 */

const MANUAL: GameSettings = { reshuffleInterval: 10, densityPercent: 30, mode: "manual" };
const PLACEMENT_MS = 20_000;

interface Plan {
  readonly squares: readonly number[];
  readonly done: boolean;
}

let harnesses: Harness[] = [];
afterEach(async () => {
  for (const h of harnesses) await h.stop();
  harnesses = [];
});

/** Frames up to (not including) the first game_over, with the random code and token masked. */
function before(client: TestClient): string[] {
  const idx = client.frames.findIndex((f) => f.includes('"type":"game_over"'));
  expect(idx).toBeGreaterThan(0);
  return client.frames
    .slice(0, idx)
    .map((f) =>
      f.replace(/"code":"[^"]*"/, '"code":"X"').replace(/"token":"[^"]*"/, '"token":"X"'),
    );
}

interface Outcome {
  readonly w: TestClient;
  readonly b: TestClient;
  readonly truth: { w: number[]; b: number[] };
}

/** Plays one placement round, then W resigns so the game-over frames arrive. */
async function run(wPlan: Plan, bPlan: Plan): Promise<Outcome> {
  const h = await startHarness({ rng: createSeededRng(11) });
  harnesses.push(h);
  const { a: w, b } = await twoPlayers(h, MANUAL);
  for (const [client, plan] of [
    [w, wPlan],
    [b, bPlan],
  ] as const) {
    for (const sq of plan.squares) client.send({ type: "place", sq });
    await client.sync();
  }
  for (const [client, plan] of [
    [w, wPlan],
    [b, bPlan],
  ] as const) {
    if (plan.done) {
      client.send({ type: "placement_done" });
      await client.sync();
    }
  }
  if (!(wPlan.done && bPlan.done)) h.clock.advance(PLACEMENT_MS);
  await w.sync();
  await b.sync();
  w.send({ type: "resign" });
  const gw = await w.next("game_over");
  const gb = await b.next("game_over");
  expect(gw.over.owned).toEqual(gb.over.owned);
  const owned = gw.over.owned;
  if (owned === undefined) throw new Error("manual game over carries owned");
  return { w, b, truth: { w: [...owned.w], b: [...owned.b] } };
}

// B always places these three and presses Done. W's plans differ wildly.
const B_FIXED: Plan = { squares: [24, 25, 26], done: true };
const W_DONE_PLANS: readonly Plan[] = [
  { squares: [16, 17, 18, 19, 20], done: true },
  { squares: [24, 25, 26, 27, 28], done: true }, // stacks on all of B's squares
  { squares: [47], done: true }, // fewer than the quota: random fill at the end
];
const W_TIMEOUT_PLANS: readonly Plan[] = [
  { squares: [], done: false },
  { squares: [24, 25, 26, 40, 41], done: false },
];
// Symmetric: W fixed, B's plans differ.
const W_FIXED: Plan = { squares: [30, 31], done: true };
const B_DONE_PLANS: readonly Plan[] = [
  { squares: [16, 17, 18, 19, 20], done: true },
  { squares: [30, 31, 32, 33, 34], done: true }, // stacks on W's squares
  { squares: [], done: true },
];
const B_TIMEOUT_PLANS: readonly Plan[] = [
  { squares: [], done: false },
  { squares: [30, 31, 46], done: false },
];

describe("an opponent's placements never change what a seat sees", () => {
  it("B sees identical frames whatever W placed (Done path)", async () => {
    const runs = [];
    for (const w of W_DONE_PLANS) runs.push(await run(w, B_FIXED));
    const [first, ...rest] = runs;
    if (first === undefined) throw new Error("no runs");
    for (const r of rest) expect(before(r.b)).toEqual(before(first.b));
    // The runs really differed on W's side.
    expect(new Set(runs.map((r) => r.truth.w.join(","))).size).toBeGreaterThan(1);
  });

  it("B sees identical frames whatever W placed (timeout path, incl. random fill)", async () => {
    const runs = [];
    for (const w of W_TIMEOUT_PLANS)
      runs.push(await run(w, { squares: [24, 25, 26], done: false }));
    const [first, ...rest] = runs;
    if (first === undefined) throw new Error("no runs");
    for (const r of rest) expect(before(r.b)).toEqual(before(first.b));
    expect(new Set(runs.map((r) => r.truth.w.join(","))).size).toBeGreaterThan(1);
  });

  it("W sees identical frames whatever B placed (Done path)", async () => {
    const runs = [];
    for (const b of B_DONE_PLANS) runs.push(await run(W_FIXED, b));
    const [first, ...rest] = runs;
    if (first === undefined) throw new Error("no runs");
    for (const r of rest) expect(before(r.w)).toEqual(before(first.w));
    expect(new Set(runs.map((r) => r.truth.b.join(","))).size).toBeGreaterThan(1);
  });

  it("W sees identical frames whatever B placed (timeout path, incl. random fill)", async () => {
    const runs = [];
    for (const b of B_TIMEOUT_PLANS) runs.push(await run({ squares: [30, 31], done: false }, b));
    const [first, ...rest] = runs;
    if (first === undefined) throw new Error("no runs");
    for (const r of rest) expect(before(r.w)).toEqual(before(first.w));
  });
});

describe("no frame carries another seat's placements", () => {
  it("keeps own drafts, auto-placed notes and `owned` strictly per seat", async () => {
    const w: Plan = { squares: [16, 17], done: false };
    const bPlan: Plan = { squares: [40, 41, 42], done: false };
    const out = await run(w, bPlan);
    const mine = { w: new Set(w.squares), b: new Set(bPlan.squares) };

    for (const seat of ["w", "b"] as const) {
      const client = seat === "w" ? out.w : out.b;
      const frames = before(client);
      for (const frame of frames) {
        // `owned`, drafts and the server-only relocation never appear before game over.
        for (const word of ['"owned"', '"drafts"', "MineRelocated", '"mines"']) {
          expect(frame).not.toContain(word);
        }
        const msg = JSON.parse(frame) as {
          view?: { placement?: { own: number[] | null } | null };
          events?: { type: string; color?: string; count?: number }[];
        };
        // Only the viewer's own placements may appear, and only squares they actually placed.
        for (const sq of msg.view?.placement?.own ?? []) expect(mine[seat].has(sq)).toBe(true);
        // MinesAutoPlaced is addressed to its own seat only.
        for (const e of msg.events ?? []) {
          if (e.type === "MinesAutoPlaced") expect(e.color).toBe(seat);
        }
      }
      // Each seat was told exactly how many of its own were placed at random.
      const autos = frames.flatMap(
        (f) =>
          (JSON.parse(f) as { events?: { type: string; count: number }[] }).events?.filter(
            (e) => e.type === "MinesAutoPlaced",
          ) ?? [],
      );
      expect(autos).toEqual([{ type: "MinesAutoPlaced", color: seat, count: 5 - mine[seat].size }]);
    }

    // `owned` is in the game_over frame, and only there.
    for (const client of [out.w, out.b]) {
      const withOwned = client.frames.filter((f) => f.includes('"owned"'));
      expect(withOwned).toHaveLength(1);
      expect(withOwned[0]).toContain('"type":"game_over"');
    }
    // The revealed layout is the truth and includes each side's own placements.
    for (const sq of w.squares) expect(out.truth.w).toContain(sq);
    for (const sq of bPlan.squares) expect(out.truth.b).toContain(sq);
    expect(out.truth.w).toHaveLength(5);
    expect(out.truth.b).toHaveLength(5);
  });

  it("an opponent only learns the ready flag, never counts or squares, from a Done press", async () => {
    const h = await startHarness({ rng: createSeededRng(11) });
    harnesses.push(h);
    const { a, b } = await twoPlayers(h, MANUAL);
    a.send({ type: "place", sq: 16 });
    a.send({ type: "place", sq: 17 });
    a.send({ type: "unplace", sq: 17 });
    await a.sync();
    expect(b.frames.filter((f) => f.includes('"update"') || f.includes('"snapshot"'))).toHaveLength(
      1, // the initial snapshot only
    );
    a.send({ type: "placement_done" });
    const update = await b.next("update");
    expect(update.events).toEqual([{ type: "PlayerReady", color: "w" }]);
    expect(update.view.placement).toEqual({
      quota: 5,
      ready: { w: true, b: false },
      own: [],
    });
  });
});
