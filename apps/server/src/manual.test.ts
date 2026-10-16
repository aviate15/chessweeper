import { afterEach, describe, expect, it } from "vitest";
import { createSeededRng, type GameSettings } from "@chessweeper/engine";
import type { ServerMessage } from "@chessweeper/protocol";
import { startHarness, twoPlayers, type Harness, type TestClient } from "./testkit";

/*
 * 3.10 Manual mine mode on the server: placement rounds, the 20 s timer (FakeClock driven),
 * errors and reconnects. The information boundary has its own file (noleak.manual.test.ts).
 */

const MANUAL: GameSettings = { reshuffleInterval: 10, densityPercent: 30, mode: "manual" };
const QUICK: GameSettings = { reshuffleInterval: 2, densityPercent: 30, mode: "manual" };
const E2E4 = { from: 12, to: 28 };
const PLACEMENT_MS = 20_000;

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function start(settings: GameSettings) {
  h = await startHarness({ rng: createSeededRng(7) });
  return { h, ...(await twoPlayers(h, settings)) };
}

const place = (c: TestClient, ...squares: number[]) => {
  for (const sq of squares) c.send({ type: "place", sq });
};

const typesOf = (messages: readonly ServerMessage[]) => messages.map((m) => m.type);

function eventTypes(m: ServerMessage): string[] {
  return m.type === "update" ? m.events.map((e) => e.type) : [];
}

/** Both players press Done; resolves when the round has ended for both. */
async function bothDone(a: TestClient, b: TestClient) {
  a.send({ type: "placement_done" });
  b.send({ type: "placement_done" });
  const ended = (m: Extract<ServerMessage, { type: "update" }>) =>
    m.events.some((e) => e.type === "PlacementEnded");
  const ua = await a.next("update", ended);
  const ub = await b.next("update", ended);
  return { ua, ub };
}

describe("mode and settings", () => {
  it("manual is kept; the room starts in placement round 1 for both seats", async () => {
    const { a, b, ja, jb } = await start(MANUAL);
    expect(ja.settings).toEqual(MANUAL);
    expect(jb.settings).toEqual(MANUAL);
    const sa = await a.next("snapshot");
    const sb = await b.next("snapshot");
    for (const s of [sa, sb]) {
      expect(s.view.phase).toEqual({
        kind: "placement",
        round: 1,
        quota: 5,
        ready: { w: false, b: false },
      });
      expect(s.view.placement).toEqual({ quota: 5, ready: { w: false, b: false }, own: [] });
      expect(s.view.mineCount).toBe(0);
    }
  });

  it("an unknown or missing mode means auto and keeps the exact auto wire shape", async () => {
    for (const mode of ["chaos", null, undefined]) {
      const hh = await startHarness();
      try {
        const c = await hh.connect();
        c.send({
          type: "create_room",
          settings: {
            reshuffleInterval: 6,
            densityPercent: 30,
            ...(mode === undefined ? {} : { mode }),
          },
        });
        const joined = await c.next("joined");
        expect(joined.settings).toEqual({ reshuffleInterval: 6, densityPercent: 30 });
        expect("mode" in joined.settings).toBe(false);
        await c.sync();
        for (const frame of c.frames) {
          expect(frame).not.toContain('"phase"');
          expect(frame).not.toContain('"placement"');
          expect(frame).not.toContain('"owned"');
        }
      } finally {
        await hh.stop();
      }
    }
  });

  it("clamps manual settings like auto ones and defaults the manual interval", async () => {
    h = await startHarness();
    const c = await h.connect();
    c.send({
      type: "create_room",
      settings: { reshuffleInterval: 999, densityPercent: -4, mode: "manual" },
    });
    const joined = await c.next("joined");
    expect(joined.settings).toEqual({ reshuffleInterval: 20, densityPercent: 5, mode: "manual" });
  });
});

describe("placement timer", () => {
  it("starts at join: the creator waits without a countdown, both get msLeft at join", async () => {
    h = await startHarness({ rng: createSeededRng(7) });
    const a = await h.connect();
    const ja = await a.create(MANUAL);
    // The creator already sees the placement screen and can place while waiting.
    place(a, 16);
    const early = await a.sync();
    expect(typesOf(early)).not.toContain("placement");
    h.clock.advance(PLACEMENT_MS * 3); // no opponent yet: nothing may fire
    expect(typesOf(await a.sync())).not.toContain("update");

    const b = await h.connect();
    await b.join(ja.code);
    const pa = await a.next("placement");
    const pb = await b.next("placement");
    expect(pa).toEqual({ type: "placement", round: 1, msLeft: PLACEMENT_MS });
    expect(pb).toEqual(pa);
  });

  it("random-fills on timeout and tells only that player how many", async () => {
    const { a, b } = await start(MANUAL);
    place(a, 16, 17);
    place(b, 40);
    await a.sync();
    await b.sync();
    h?.clock.advance(PLACEMENT_MS);
    const ua = await a.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    const ub = await b.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    expect(ua.events).toContainEqual({ type: "MinesAutoPlaced", color: "w", count: 3 });
    expect(ub.events).toContainEqual({ type: "MinesAutoPlaced", color: "b", count: 4 });
    expect(ua.events.filter((e) => e.type === "MinesAutoPlaced")).toHaveLength(1);
    expect(ub.events.filter((e) => e.type === "MinesAutoPlaced")).toHaveLength(1);
    for (const u of [ua, ub]) {
      expect(u.view.phase).toEqual({ kind: "play" });
      expect(u.view.placement).toBeNull();
      expect(u.view.mineCount).toBe(10);
      expect(u.events).toContainEqual({ type: "PlacementEnded", mineCount: 10 });
    }
    // Play now works: the board accepts a move from the next seq.
    a.send({ type: "move", seq: ua.seq, ...E2E4 });
    await a.next("update", (m) => m.seq === ua.seq + 1);
  });

  it("a timeout with nothing placed fills both sides completely", async () => {
    const { a, b } = await start(MANUAL);
    h?.clock.advance(PLACEMENT_MS);
    const ua = await a.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    const ub = await b.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    expect(ua.events).toContainEqual({ type: "MinesAutoPlaced", color: "w", count: 5 });
    expect(ub.events).toContainEqual({ type: "MinesAutoPlaced", color: "b", count: 5 });
  });

  it("ends early when both press Done, and the timer then does nothing", async () => {
    const { a, b } = await start(MANUAL);
    place(a, 16, 17, 18, 19, 20);
    place(b, 24, 25, 26, 27, 28);
    a.send({ type: "placement_done" });
    const first = await b.next("update", (m) => eventTypes(m).includes("PlayerReady"));
    expect(first.events).toEqual([{ type: "PlayerReady", color: "w" }]);
    expect(first.view.phase).toMatchObject({ kind: "placement", ready: { w: true, b: false } });
    b.send({ type: "placement_done" });
    const ended = (m: Extract<ServerMessage, { type: "update" }>) =>
      m.events.some((e) => e.type === "PlacementEnded");
    const ua = await a.next("update", ended);
    const ub = await b.next("update", ended);
    // Full quotas: nothing was placed at random, so nobody is told about auto placement.
    for (const u of [ua, ub]) expect(u.events).toEqual([{ type: "PlacementEnded", mineCount: 10 }]);
    await a.sync();
    await b.sync();
    const frames = a.frames.length + b.frames.length;
    h?.clock.advance(PLACEMENT_MS * 2);
    await a.sync();
    await b.sync();
    // Only the two pongs: the cancelled timer produced nothing.
    expect(a.frames.length + b.frames.length).toBe(frames + 2);
  });

  it("a second Done press is already-ready; moves, place and unplace are rejected after", async () => {
    const { a, b } = await start(MANUAL);
    place(a, 16);
    a.send({ type: "placement_done" });
    a.send({ type: "placement_done" });
    expect((await a.next("error")).code).toBe("already-ready");
    a.send({ type: "place", sq: 17 });
    expect((await a.next("error")).code).toBe("already-ready");
    a.send({ type: "unplace", sq: 16 });
    expect((await a.next("error")).code).toBe("already-ready");
    await b.sync();
  });

  it("starts a fresh 20 s timer when a reshuffle opens the next placement round", async () => {
    const { a, b } = await start(QUICK);
    await bothDone(a, b);
    const seq = 3; // two Done presses plus the end of round 1
    a.send({ type: "move", seq, from: 6, to: 21 }); // Nf3
    await a.next("update", (m) => m.seq === seq + 1);
    await b.next("update", (m) => m.seq === seq + 1);
    h?.clock.advance(7_000); // time passing in play must not matter
    b.send({ type: "move", seq: seq + 1, from: 62, to: 45 }); // ...Nf6
    const ua = await a.next("update", (m) => m.seq === seq + 2);
    await b.next("update", (m) => m.seq === seq + 2);
    expect(ua.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["Reshuffled", "PlacementStarted"]),
    );
    expect(ua.view.phase).toMatchObject({ kind: "placement", round: 2 });
    expect(ua.view.mineCount).toBe(0);
    expect(await a.next("placement", (m) => m.round === 2)).toEqual({
      type: "placement",
      round: 2,
      msLeft: PLACEMENT_MS,
    });
    expect(await b.next("placement", (m) => m.round === 2)).toEqual({
      type: "placement",
      round: 2,
      msLeft: PLACEMENT_MS,
    });
    // Moves are rejected while round 2 is open.
    a.send({ type: "move", seq: seq + 2, ...E2E4 });
    expect((await a.next("error")).code).toBe("not-placing");
    h?.clock.advance(PLACEMENT_MS);
    const done = await a.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    expect(done.view.phase).toEqual({ kind: "play" });
    expect(done.events).toContainEqual({ type: "MinesAutoPlaced", color: "w", count: 5 });
  });
});

describe("reconnect and end of game during placement", () => {
  it("keeps the drafts through a disconnect and hands them back with the time left", async () => {
    const { a, b, ja } = await start(MANUAL);
    place(a, 30, 18, 22);
    await a.sync();
    await a.close();
    expect((await b.next("opponent", (m) => m.state === "disconnected")).state).toBe(
      "disconnected",
    );
    h?.clock.advance(5_000); // the timer keeps running through the disconnect
    const a2 = await h?.connect();
    if (a2 === undefined) throw new Error("no client");
    await a2.join(ja.code, ja.token);
    const snap = await a2.next("snapshot");
    expect(snap.view.placement).toEqual({
      quota: 5,
      ready: { w: false, b: false },
      own: [18, 22, 30],
    });
    expect(await a2.next("placement")).toEqual({
      type: "placement",
      round: 1,
      msLeft: PLACEMENT_MS - 5_000,
    });
    // The draft is still editable and the round still ends on the original deadline.
    a2.send({ type: "unplace", sq: 22 });
    expect((await a2.next("snapshot")).view.placement?.own).toEqual([18, 30]);
    h?.clock.advance(PLACEMENT_MS - 5_000);
    const end = await a2.next("update", (m) => eventTypes(m).includes("PlacementEnded"));
    expect(end.events).toContainEqual({ type: "MinesAutoPlaced", color: "w", count: 3 });
  });

  it("the opponent's reconnect snapshot carries only their own draft", async () => {
    const { a, b, ja, jb } = await start(MANUAL);
    place(a, 16, 17);
    place(b, 40);
    await a.sync();
    await b.sync();
    await b.close();
    const b2 = await h?.connect();
    if (b2 === undefined) throw new Error("no client");
    await b2.join(ja.code, jb.token);
    const snap = await b2.next("snapshot");
    expect(snap.view.placement?.own).toEqual([40]);
    expect(b2.frames.join("")).not.toMatch(/"own":\[[^\]]*1[67][^\]]*\]/);
  });

  it("resigning during placement ends the game at once and stops the timer", async () => {
    const { a, b } = await start(MANUAL);
    place(a, 16);
    b.send({ type: "resign" });
    const ua = await a.next("update", (m) => eventTypes(m).includes("GameOver"));
    expect(ua.events).toContainEqual({ type: "GameOver", result: "w", reason: "resignation" });
    const goa = await a.next("game_over");
    const gob = await b.next("game_over");
    expect(goa.over.view.status.kind).toBe("over");
    expect(gob.over.view.status.kind).toBe("over");
    await a.sync();
    const frames = a.frames.length;
    h?.clock.advance(PLACEMENT_MS * 2);
    await a.sync();
    // Only the pong frames since: no PlacementEnded update was produced by a stale timer.
    expect(a.frames.slice(frames).every((f) => f.includes('"pong"'))).toBe(true);
    // Placing after the end is refused.
    a.send({ type: "place", sq: 17 });
    expect((await a.next("error")).code).toBe("game-over");
  });

  it("a draw can be offered and accepted during placement", async () => {
    const { a, b } = await start(MANUAL);
    a.send({ type: "draw_offer" });
    await b.next("draw", (m) => m.state === "offered");
    b.send({ type: "draw_reply", accept: true });
    const ub = await b.next("update", (m) => eventTypes(m).includes("GameOver"));
    expect(ub.events).toContainEqual({ type: "GameOver", result: "draw", reason: "agreement" });
    await a.next("game_over");
  });
});

describe("placement errors and privacy of draft traffic", () => {
  it("maps engine placement errors to wire codes", async () => {
    const { a } = await start(MANUAL);
    a.send({ type: "place", sq: 0 }); // occupied by a rook
    expect((await a.next("error")).code).toBe("bad-square");
    place(a, 16, 17, 18, 19, 20);
    await a.sync();
    a.send({ type: "place", sq: 21 });
    expect((await a.next("error")).code).toBe("quota-full");
    // Re-placing an own mine and unplacing an empty square are harmless no-ops.
    a.send({ type: "place", sq: 16 });
    expect((await a.next("snapshot")).view.placement?.own).toEqual([16, 17, 18, 19, 20]);
    a.send({ type: "unplace", sq: 40 });
    expect((await a.next("snapshot")).view.placement?.own).toEqual([16, 17, 18, 19, 20]);
  });

  it("rejects moves during placement", async () => {
    const { a, b } = await start(MANUAL);
    a.send({ type: "move", seq: 0, ...E2E4 });
    expect((await a.next("error")).code).toBe("not-placing");
    b.send({ type: "move", seq: 0, from: 52, to: 36 });
    expect((await b.next("error")).code).toBe("not-placing");
  });

  it("rejects place messages in an auto game and once play has started", async () => {
    h = await startHarness({ rng: createSeededRng(7) });
    const { a } = await twoPlayers(h);
    a.send({ type: "place", sq: 16 });
    expect((await a.next("error")).code).toBe("not-placing");
    a.send({ type: "placement_done" });
    expect((await a.next("error")).code).toBe("not-placing");

    const m = await twoPlayers(h, MANUAL);
    h.clock.advance(PLACEMENT_MS);
    await m.a.next("update", (u) => eventTypes(u).includes("PlacementEnded"));
    m.a.send({ type: "place", sq: 16 });
    expect((await m.a.next("error")).code).toBe("not-placing");
  });

  it("answers place and unplace only to the placer, without touching seq", async () => {
    const { a, b } = await start(MANUAL);
    await a.sync();
    const bFrames = b.frames.length;
    place(a, 16, 17, 18);
    a.send({ type: "unplace", sq: 17 });
    const last = await a.sync();
    const snaps = last.filter((m) => m.type === "snapshot");
    expect(snaps).toHaveLength(4);
    expect(snaps.every((m) => m.type === "snapshot" && m.seq === 0)).toBe(true);
    await b.sync();
    expect(b.frames.slice(bFrames).every((f) => f.includes('"pong"'))).toBe(true);
  });
});
