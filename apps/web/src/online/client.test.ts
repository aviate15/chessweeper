import { createGame, createSeededRng, toPublicView, type PublicView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import {
  BACKOFF_MS,
  OnlineClient,
  PING_INTERVAL_MS,
  type ClientEvent,
  type SocketLike,
} from "./client";
import { FakeSocket, FakeTimers } from "./testkit";

const CODE = "ABCDEF";
const TOKEN = "tok_en-123";
const SETTINGS = { reshuffleInterval: 6, densityPercent: 30 };

function view(): PublicView {
  return toPublicView(createGame({ rng: createSeededRng(1) }), "w");
}

function setup() {
  const sockets: FakeSocket[] = [];
  const timers = new FakeTimers();
  const events: ClientEvent[] = [];
  const client = new OnlineClient({
    url: "ws://test",
    timers,
    createSocket: (url): SocketLike => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
  });
  client.subscribe((e) => events.push(e));
  const last = () => {
    const s = sockets[sockets.length - 1];
    if (!s) throw new Error("no socket");
    return s;
  };
  const types = () => events.map((e) => e.type);
  return { client, sockets, timers, events, last, types };
}

const joined = { type: "joined", code: CODE, seat: "w", token: TOKEN, settings: SETTINGS } as const;

describe("create and join", () => {
  it("create: sends create_room on open, then joined and snapshot arrive", () => {
    const { client, last, events } = setup();
    client.create();
    expect(client.state).toBe("connecting");
    last().open();
    expect(last().sent).toEqual([{ type: "create_room" }]);
    last().receive(joined);
    last().receive({ type: "snapshot", seq: 0, view: view() });
    expect(events.map((e) => e.type)).toEqual(["connection", "connection", "joined", "snapshot"]);
    expect(client.state).toBe("open");
  });

  it("join: sends join_room with the code, and the token on a resume", () => {
    const a = setup();
    a.client.join(CODE);
    a.last().open();
    expect(a.last().sent).toEqual([{ type: "join_room", code: CODE }]);
    const b = setup();
    b.client.join(CODE, TOKEN);
    b.last().open();
    expect(b.last().sent).toEqual([{ type: "join_room", code: CODE, token: TOKEN }]);
  });
});

describe("moves", () => {
  it("stamps the current seq and follows updates", () => {
    const { client, last } = setup();
    client.create();
    last().open();
    last().receive(joined);
    expect(client.move(12, 28)).toBe(false); // no view yet, so no seq to quote
    last().receive({ type: "snapshot", seq: 4, view: view() });
    expect(client.move(12, 28)).toBe(true);
    last().receive({ type: "update", seq: 5, events: [], view: view() });
    expect(client.move(52, 60, "q")).toBe(true);
    expect(last().sent.slice(1)).toEqual([
      { type: "move", seq: 4, from: 12, to: 28 },
      { type: "move", seq: 5, from: 52, to: 60, promo: "q" },
    ]);
  });

  it("sends resign, draw and claim messages, but only while the socket is open", () => {
    const { client, last } = setup();
    client.create();
    expect(client.resign()).toBe(false); // still connecting
    last().open();
    last().receive(joined);
    expect(client.resign()).toBe(true);
    expect(client.offerDraw()).toBe(true);
    expect(client.replyDraw(false)).toBe(true);
    expect(client.claimWin()).toBe(true);
    expect(last().sent.slice(1)).toEqual([
      { type: "resign" },
      { type: "draw_offer" },
      { type: "draw_reply", accept: false },
      { type: "claim_win" },
    ]);
  });

  it("never sends a message that fails the schema", () => {
    const { client, last } = setup();
    client.create();
    last().open();
    last().receive({ ...joined });
    last().receive({ type: "snapshot", seq: 0, view: view() });
    const before = last().sent.length;
    expect(client.move(64, 3)).toBe(false); // square out of range
    expect(client.move(1.5, 3)).toBe(false);
    expect(last().sent).toHaveLength(before);
  });
});

describe("inbound validation", () => {
  it("turns bad frames into a protocol error instead of throwing", () => {
    const { client, last, events } = setup();
    client.create();
    last().open();
    last().receive("not json");
    last().receive({ type: "nope" });
    last().receive({ type: "snapshot", seq: 0, view: { ...view(), mines: [1, 2] } });
    expect(events.filter((e) => e.type === "error")).toEqual([
      { type: "error", code: "protocol" },
      { type: "error", code: "protocol" },
      { type: "error", code: "protocol" },
    ]);
    expect(events.some((e) => e.type === "snapshot")).toBe(false);
  });

  it("passes server errors on with their code", () => {
    const { client, last, events } = setup();
    client.join(CODE);
    last().open();
    last().receive({ type: "error", code: "room-not-found", message: "Room not found" });
    expect(events).toContainEqual({ type: "error", code: "room-not-found" });
  });

  it("relays opponent, draw and game_over messages", () => {
    const { client, last, types } = setup();
    client.create();
    last().open();
    last().receive(joined);
    last().receive({ type: "opponent", state: "disconnected" });
    last().receive({ type: "draw", state: "offered" });
    last().receive({ type: "pong" });
    last().receive({ type: "game_over", over: { view: view(), mines: [20, 21] } });
    expect(types()).toEqual([
      "connection",
      "connection",
      "joined",
      "opponent",
      "draw",
      "game_over",
    ]);
  });
});

describe("reconnect", () => {
  function playing() {
    const s = setup();
    s.client.create();
    s.last().open();
    s.last().receive(joined);
    s.last().receive({ type: "snapshot", seq: 2, view: view() });
    return s;
  }

  it("backs off 0.5, 1, 2, 4, 8, 10 s and rejoins with the token", () => {
    const s = playing();
    s.last().drop();
    expect(s.client.state).toBe("reconnecting");
    expect(s.sockets).toHaveLength(1);
    for (let i = 0; i < BACKOFF_MS.length + 1; i++) {
      const delay = BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)] ?? 0;
      s.timers.advance(delay - 1);
      expect(s.sockets).toHaveLength(i + 1);
      s.timers.advance(1);
      expect(s.sockets).toHaveLength(i + 2);
      s.last().drop(); // still unreachable
    }
    s.timers.advance(10_000);
    s.last().open();
    expect(s.last().sent).toEqual([{ type: "join_room", code: CODE, token: TOKEN }]);
  });

  it("resets the backoff once rejoined and applies the new snapshot", () => {
    const s = playing();
    s.last().drop();
    s.timers.advance(500);
    s.last().open();
    s.last().receive(joined);
    s.last().receive({ type: "snapshot", seq: 3, view: view() });
    expect(s.client.state).toBe("open");
    expect(s.client.move(12, 28)).toBe(true);
    expect(s.last().sent.at(-1)).toMatchObject({ type: "move", seq: 3 });
    s.last().drop();
    s.timers.advance(500);
    expect(s.sockets).toHaveLength(3);
  });

  it("stops with taken-over on close code 1000 and room-closed on 1001", () => {
    const a = playing();
    a.last().drop(1000);
    expect(a.events.at(-1)).toEqual({ type: "fatal", reason: "taken-over" });
    a.timers.advance(60_000);
    expect(a.sockets).toHaveLength(1);
    const b = playing();
    b.last().drop(1001);
    expect(b.events.at(-1)).toEqual({ type: "fatal", reason: "room-closed" });
    expect(b.client.state).toBe("closed");
  });

  it("gives up when a rejoin finds the room gone", () => {
    const s = playing();
    s.last().drop();
    s.timers.advance(500);
    s.last().open();
    s.last().receive({ type: "error", code: "room-not-found", message: "Room not found" });
    expect(s.events.at(-1)).toEqual({ type: "fatal", reason: "game-gone" });
    s.timers.advance(60_000);
    expect(s.sockets).toHaveLength(2);
  });

  it("does not retry a create or first join that never got a seat", () => {
    const s = setup();
    s.client.create();
    s.last().drop();
    expect(s.events.at(-1)).toEqual({ type: "fatal", reason: "connect-failed" });
    s.timers.advance(60_000);
    expect(s.sockets).toHaveLength(1);
  });

  it("reconnects for a fresh snapshot after stale-seq", () => {
    const s = playing();
    const first = s.last();
    first.receive({ type: "error", code: "stale-seq", message: "Your view is out of date" });
    expect(s.events).toContainEqual({ type: "error", code: "stale-seq" });
    expect(first.closedWith).not.toBeUndefined();
    s.timers.advance(500);
    expect(s.sockets).toHaveLength(2);
    s.last().open();
    expect(s.last().sent).toEqual([{ type: "join_room", code: CODE, token: TOKEN }]);
  });

  it("does not reconnect after game over or after close()", () => {
    const a = playing();
    a.last().receive({ type: "game_over", over: { view: view(), mines: [] } });
    a.last().drop();
    a.timers.advance(60_000);
    expect(a.sockets).toHaveLength(1);
    const b = playing();
    b.client.close();
    b.timers.advance(60_000);
    expect(b.sockets).toHaveLength(1);
    expect(b.client.state).toBe("closed");
  });
});

describe("keepalive", () => {
  it("pings every 25 s while open and stops when closed", () => {
    const s = setup();
    s.client.create();
    s.last().open();
    s.last().receive(joined);
    s.timers.advance(PING_INTERVAL_MS * 2);
    expect(s.last().sent.filter((m) => (m as { type: string }).type === "ping")).toHaveLength(2);
    s.client.close();
    expect(s.timers.pending()).toBe(0);
  });
});
