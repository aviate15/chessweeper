import { afterEach, describe, expect, it } from "vitest";
import { CODE_ALPHABET } from "@chessweeper/protocol";
import { startHarness, twoPlayers, TestClient, type Harness } from "./testkit";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const E2 = 12;
const E4 = 28;
const E7 = 52;
const E5 = 36;

async function start(...args: Parameters<typeof startHarness>): Promise<Harness> {
  h = await startHarness(...args);
  return h;
}

/** HTTP status of a rejected upgrade, or "open". */
async function upgradeStatus(
  hh: Harness,
  origin: string | null,
  headers?: Record<string, string>,
): Promise<string> {
  try {
    const c = await hh.connect({ origin, ...(headers === undefined ? {} : { headers }) });
    c;
    return "open";
  } catch (e) {
    return (e as Error).message;
  }
}

describe("rooms and seats", () => {
  it("creates a room, joins the second seat and reconnects with the token", async () => {
    const hh = await start();
    const a = await hh.connect();
    const ja = await a.create();
    expect(ja.seat).toBe("w");
    expect(ja.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    expect(ja.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const snap = await a.next("snapshot");
    expect(snap.seq).toBe(0);
    expect(snap.view.viewer).toBe("w");

    const b = await hh.connect();
    const jb = await b.join(ja.code);
    expect(jb.seat).toBe("b");
    expect(jb.token).not.toBe(ja.token);
    expect((await b.next("snapshot")).view.viewer).toBe("b");
    await a.next("opponent", (m) => m.state === "connected");

    // 3.6: a disconnected player can reconnect and gets the same seat back.
    await a.close();
    await b.next("opponent", (m) => m.state === "disconnected");
    const a2 = await hh.connect();
    const again = await a2.join(ja.code, ja.token);
    expect(again.seat).toBe("w");
    expect(again.token).toBe(ja.token);
    expect((await a2.next("snapshot")).view.viewer).toBe("w");
    await b.next("opponent", (m) => m.state === "connected");
  });

  it("rejects an unknown room, a wrong token and a third player", async () => {
    const hh = await start();
    const { a, ja } = await twoPlayers(hh);
    a;
    const c = await hh.connect();
    c.send({ type: "join_room", code: "ZZZZZZ" });
    expect((await c.next("error")).code).toBe("room-not-found");
    c.send({ type: "join_room", code: ja.code, token: "x".repeat(43) });
    expect((await c.next("error")).code).toBe("forbidden");
    c.send({ type: "join_room", code: ja.code });
    expect((await c.next("error")).code).toBe("room-full");
  });

  it("a newer connection takes over a seat", async () => {
    const hh = await start();
    const { a, ja, b } = await twoPlayers(hh);
    const a2 = await hh.connect();
    await a2.join(ja.code, ja.token);
    expect(await a.closed).toBe(1000);
    // The takeover is not a disconnect: the opponent hears nothing about it.
    const seen = await b.sync();
    expect(seen.some((m) => m.type === "opponent" && m.state === "disconnected")).toBe(false);
  });

  it("refuses game messages before joining and a second create", async () => {
    const hh = await start();
    const a = await hh.connect();
    a.send({ type: "resign" });
    expect((await a.next("error")).code).toBe("forbidden");
    await a.create();
    a.send({ type: "create_room" });
    expect((await a.next("error")).code).toBe("forbidden");
  });
});

describe("moves", () => {
  it("enforces turn, seq and legality; projects events and views per seat", async () => {
    const hh = await start();
    const { a, b } = await twoPlayers(hh);
    await a.next("snapshot");
    await b.next("snapshot");

    b.send({ type: "move", seq: 0, from: E7, to: E5 });
    expect((await b.next("error")).code).toBe("not-your-turn");

    a.send({ type: "move", seq: 5, from: E2, to: E4 });
    expect((await a.next("error")).code).toBe("stale-seq");

    a.send({ type: "move", seq: 0, from: E2, to: 44 });
    const bad = await a.next("error");
    expect(bad).toEqual({ type: "error", code: "illegal-move", message: "Illegal move" });

    a.send({ type: "move", seq: 0, from: E2, to: E4 });
    const ua = await a.next("update");
    const ub = await b.next("update");
    expect(ua.seq).toBe(1);
    expect(ua.view.viewer).toBe("w");
    expect(ub.view.viewer).toBe("b");
    expect(ua.events.some((e) => e.type === "MoveMade")).toBe(true);
    expect(ub.view.turn).toBe("b");

    a.send({ type: "move", seq: 1, from: 8, to: 16 });
    expect((await a.next("error")).code).toBe("not-your-turn");
    b.send({ type: "move", seq: 1, from: E7, to: E5 });
    expect((await b.next("update")).seq).toBe(2);
  });
});

describe("draws (3.6)", () => {
  it("offer, decline, re-offer rule, lapse on move, accept", async () => {
    const hh = await start();
    const { a, b } = await twoPlayers(hh);

    a.send({ type: "draw_reply", accept: true });
    expect((await a.next("error")).code).toBe("forbidden"); // nothing pending

    a.send({ type: "draw_offer" });
    expect((await b.next("draw")).state).toBe("offered");
    a.send({ type: "draw_offer" });
    expect((await a.next("error")).code).toBe("forbidden"); // at most one pending
    a.send({ type: "draw_reply", accept: true });
    expect((await a.next("error")).code).toBe("forbidden"); // cannot answer own offer
    b.send({ type: "draw_reply", accept: false });
    expect((await a.next("draw")).state).toBe("declined");
    a.send({ type: "draw_offer" });
    expect((await a.next("error")).code).toBe("forbidden"); // offerer must move first

    a.send({ type: "move", seq: 0, from: E2, to: E4 });
    await a.next("update");
    await b.next("update");

    b.send({ type: "draw_offer" }); // either side may offer anytime
    expect((await a.next("draw")).state).toBe("offered");
    b.send({ type: "move", seq: 1, from: E7, to: E5 });
    expect((await a.next("draw")).state).toBe("lapsed"); // any move lapses the offer
    expect((await b.next("draw")).state).toBe("lapsed");
    await a.next("update");
    await b.next("update");

    b.send({ type: "draw_offer" }); // B has moved since, so may offer again
    expect((await a.next("draw")).state).toBe("offered");
    a.send({ type: "draw_reply", accept: true });
    const over = await a.next("game_over");
    expect(over.over.view.status).toEqual({ kind: "over", result: "draw", reason: "agreement" });
    expect((await b.next("game_over")).over.view.status.kind).toBe("over");
  });

  it("resign ends the game for the resigner, then moves are rejected (3.6)", async () => {
    const hh = await start();
    const { a, b } = await twoPlayers(hh);
    a.send({ type: "resign" });
    const over = await b.next("game_over");
    expect(over.over.view.status).toEqual({ kind: "over", result: "b", reason: "resignation" });
    await a.next("game_over");
    a.send({ type: "move", seq: 1, from: E2, to: E4 });
    expect((await a.next("error")).code).toBe("game-over");
    b.send({ type: "draw_offer" });
    expect((await b.next("error")).code).toBe("game-over");
  });
});

describe("disconnects (3.6: 60 s grace)", () => {
  it("lets the opponent claim the win after the grace period", async () => {
    const hh = await start();
    const { a, b } = await twoPlayers(hh);
    await b.close();
    await a.next("opponent", (m) => m.state === "disconnected");
    a.send({ type: "claim_win" });
    expect((await a.next("error")).code).toBe("forbidden"); // too early
    hh.clock.advance(59_000);
    a.send({ type: "claim_win" });
    expect((await a.next("error")).code).toBe("forbidden");
    hh.clock.advance(1_000);
    await a.next("opponent", (m) => m.state === "claimable");
    a.send({ type: "claim_win" });
    const over = await a.next("game_over");
    expect(over.over.view.status).toEqual({ kind: "over", result: "w", reason: "abandonment" });
  });

  it("restores the seat after the grace period if nobody has claimed", async () => {
    const hh = await start();
    const { a, b, jb, ja } = await twoPlayers(hh);
    await b.close();
    await a.next("opponent", (m) => m.state === "disconnected");
    hh.clock.advance(60_000);
    await a.next("opponent", (m) => m.state === "claimable");
    const b2 = await hh.connect();
    await b2.join(ja.code, jb.token);
    await a.next("opponent", (m) => m.state === "connected");
    a.send({ type: "claim_win" });
    expect((await a.next("error")).code).toBe("forbidden");
  });

  it("tells a reconnecting player the opponent is claimable", async () => {
    const hh = await start();
    const { a, b, ja } = await twoPlayers(hh);
    await b.close();
    await a.next("opponent", (m) => m.state === "disconnected");
    hh.clock.advance(60_000);
    await a.next("opponent", (m) => m.state === "claimable");
    await a.close();
    await hh.logged("seat_disconnected", 2);
    const a2 = await hh.connect();
    await a2.join(ja.code, ja.token);
    expect((await a2.next("opponent")).state).toBe("claimable");
  });
});

describe("room expiry", () => {
  it("drops an idle room after 30 minutes", async () => {
    const hh = await start();
    const { a } = await twoPlayers(hh);
    hh.clock.advance(29 * 60_000);
    expect(hh.server.roomCount()).toBe(1);
    hh.clock.advance(60_000);
    expect(hh.server.roomCount()).toBe(0);
    expect(await a.closed).toBe(1001);
  });

  it("drops an empty room sooner and forgets its tokens", async () => {
    const hh = await start();
    const { a, b, ja } = await twoPlayers(hh);
    await a.close();
    await b.close();
    await hh.logged("seat_disconnected", 2);
    hh.clock.advance(5 * 60_000);
    expect(hh.server.roomCount()).toBe(0);
    const c = await hh.connect();
    c.send({ type: "join_room", code: ja.code, token: ja.token });
    expect((await c.next("error")).code).toBe("room-not-found");
  });

  it("activity resets the idle timer", async () => {
    const hh = await start();
    const { a } = await twoPlayers(hh);
    hh.clock.advance(20 * 60_000);
    a.send({ type: "ping" });
    a.send({ type: "draw_offer" }); // a game message counts as activity
    await a.sync();
    hh.clock.advance(20 * 60_000);
    expect(hh.server.roomCount()).toBe(1);
  });
});

describe("hardening", () => {
  it("rejects a missing or unknown Origin on upgrade", async () => {
    const hh = await start();
    expect(await upgradeStatus(hh, "http://evil.test")).toBe("status 403");
    expect(await upgradeStatus(hh, null)).toBe("status 403");
    expect(await upgradeStatus(hh, "http://app.test")).toBe("open");
  });

  it("fails closed with no allowed origins", async () => {
    const hh = await start({ allowedOrigins: [] });
    expect(await upgradeStatus(hh, "http://app.test")).toBe("status 403");
  });

  it("closes a connection that sends an oversized frame", async () => {
    const hh = await start();
    const a = await hh.connect();
    a.sendRaw("x".repeat(5000));
    expect(await a.closed).toBe(1009);
  });

  it("answers junk with a generic bad-message error and never echoes it", async () => {
    const hh = await start();
    const a = await hh.connect();
    a.sendRaw("SECRET-JUNK{");
    const err = await a.next("error");
    expect(err).toEqual({ type: "error", code: "bad-message", message: "Malformed message" });
    a.sendRaw(JSON.stringify({ type: "ping", extra: "SECRET-EXTRA" }));
    await a.next("error");
    expect(a.frames.join("")).not.toContain("SECRET");
  });

  it("rejects binary frames", async () => {
    const hh = await start();
    const a = await hh.connect();
    a.ws.send(Buffer.from([1, 2, 3]));
    expect((await a.next("error")).code).toBe("bad-message");
  });

  it("rate limits a connection with a token bucket and then closes it", async () => {
    const hh = await start({ limits: { messageBurst: 3, messagesPerSecond: 1 } });
    const a = await hh.connect();
    for (let i = 0; i < 5; i++) a.send({ type: "ping" });
    const err = await a.next("error");
    expect(err.code).toBe("rate-limited");
    expect(await a.closed).toBe(1008);
  });

  it("refills the bucket over time", async () => {
    const hh = await start({ limits: { messageBurst: 2, messagesPerSecond: 1 } });
    const a = await hh.connect();
    a.send({ type: "ping" });
    a.send({ type: "ping" });
    await a.next("pong");
    await a.next("pong");
    hh.clock.advance(1000);
    a.send({ type: "ping" });
    await a.next("pong");
  });

  it("caps connections per IP", async () => {
    const hh = await start({ limits: { maxConnectionsPerIp: 2 } });
    await hh.connect();
    const second = await hh.connect();
    expect(await upgradeStatus(hh, "http://app.test")).toBe("status 429");
    await second.close();
    expect(await upgradeStatus(hh, "http://app.test")).toBe("open");
  });

  it("caps rooms per IP and globally, and frees the slot when a room expires", async () => {
    const hh = await start({ limits: { maxRoomsPerIp: 1 } });
    const a = await hh.connect();
    await a.create();
    const b = await hh.connect();
    b.send({ type: "create_room" });
    expect((await b.next("error")).code).toBe("rate-limited");
    hh.clock.advance(30 * 60_000);
    const c = await hh.connect();
    await c.create();
    await hh.stop();

    const g = await start({ limits: { maxRooms: 1 }, trustProxy: true });
    const x = await g.connect({ headers: { "Fly-Client-IP": "10.0.0.1" } });
    await x.create();
    const y = await g.connect({ headers: { "Fly-Client-IP": "10.0.0.2" } });
    y.send({ type: "create_room" });
    expect((await y.next("error")).code).toBe("rate-limited");
  });

  it("ignores Fly-Client-IP unless TRUST_PROXY is on", async () => {
    const hh = await start({ limits: { maxConnectionsPerIp: 1 }, trustProxy: false });
    await hh.connect({ headers: { "Fly-Client-IP": "10.0.0.1" } });
    // Different claimed IP, same socket address: the header is not trusted, so the cap bites.
    expect(await upgradeStatus(hh, "http://app.test", { "Fly-Client-IP": "10.0.0.2" })).toBe(
      "status 429",
    );
  });

  it("reads Fly-Client-IP when TRUST_PROXY is on, and falls back on a bad header", async () => {
    const hh = await start({ limits: { maxConnectionsPerIp: 1 }, trustProxy: true });
    await hh.connect({ headers: { "Fly-Client-IP": "10.0.0.1" } });
    expect(await upgradeStatus(hh, "http://app.test", { "Fly-Client-IP": "10.0.0.2" })).toBe(
      "open",
    );
    expect(await upgradeStatus(hh, "http://app.test", { "Fly-Client-IP": "10.0.0.1" })).toBe(
      "status 429",
    );
    // A malformed header is ignored (socket address 127.0.0.1 is used), never trusted.
    expect(await upgradeStatus(hh, "http://app.test", { "Fly-Client-IP": "not-an-ip" })).toBe(
      "open",
    );
    expect(await upgradeStatus(hh, "http://app.test", { "Fly-Client-IP": "also-bad" })).toBe(
      "status 429",
    );
  });

  it("never logs seat tokens or invite codes", async () => {
    const hh = await start();
    const { a, ja, jb } = await twoPlayers(hh);
    await a.close();
    const a2 = await hh.connect();
    await a2.join(ja.code, ja.token);
    const bad = await hh.connect();
    bad.send({ type: "join_room", code: ja.code, token: "w".repeat(43) });
    await bad.next("error");
    hh.clock.advance(30 * 60_000);
    const text = hh.logs.join("\n");
    expect(hh.logs.length).toBeGreaterThan(0);
    for (const secret of [ja.token, jb.token, ja.code, "w".repeat(43)]) {
      expect(text).not.toContain(secret);
    }
  });

  it("serves /healthz and 404s everything else over plain HTTP", async () => {
    const hh = await start();
    const base = hh.url.replace("ws:", "http:");
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/anything`)).status).toBe(404);
  });
});

TestClient;
