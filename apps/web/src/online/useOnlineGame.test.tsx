import {
  createGame,
  createSeededRng,
  legalMoves,
  projectEvents,
  toPublicView,
  tryResolveMove,
  type EventView,
  type PublicView,
} from "@chessweeper/engine";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OnlineClient, type SocketLike } from "./client";
import { loadCurrent, loadFlags, loadSeat, saveCurrent, saveFlags, saveSeat } from "./storage";
import { FakeSocket, FakeTimers } from "./testkit";
import { useOnlineGame } from "./useOnlineGame";

const CODE = "ABCDEF";
const TOKEN = "tok_en-123";
const SETTINGS = { reshuffleInterval: 6, densityPercent: 30 };

// One real first move, so updates carry valid projected events.
const start = createGame({ rng: createSeededRng(7) });
const firstMove = legalMoves(start.position).find((m) => m.from === 12 && m.to === 28);
if (!firstMove) throw new Error("e2e4 missing");
const resolved = tryResolveMove(start, firstMove, createSeededRng(7));
if (!resolved.ok) throw new Error("move failed");
const MOVE_EVENTS = projectEvents(resolved.resolution.events);
const viewAfter = (viewer: "w" | "b"): PublicView =>
  toPublicView(resolved.resolution.state, viewer);
const startView = (viewer: "w" | "b"): PublicView => toPublicView(start, viewer);

function harness(resumeOnMount = false) {
  const sockets: FakeSocket[] = [];
  const timers = new FakeTimers();
  const createClient = () =>
    new OnlineClient({
      url: "ws://test",
      timers,
      createSocket: (url): SocketLike => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s;
      },
    });
  const hook = renderHook(() => useOnlineGame({ createClient, resumeOnMount }));
  const socket = () => {
    const s = sockets[sockets.length - 1];
    if (!s) throw new Error("no socket");
    return s;
  };
  const receive = (message: unknown) => {
    act(() => {
      socket().receive(message);
    });
  };
  const open = () => {
    act(() => {
      socket().open();
    });
  };
  const seat = (s: "w" | "b") => {
    receive({ type: "joined", code: CODE, seat: s, token: TOKEN, settings: SETTINGS });
    receive({ type: "snapshot", seq: 0, view: startView(s) });
  };
  return { hook, sockets, socket, receive, open, seat, timers };
}

afterEach(() => {
  localStorage.clear();
});

describe("useOnlineGame phases", () => {
  it("starts in the lobby, then connecting, waiting, playing", () => {
    const h = harness();
    expect(h.hook.result.current.phase).toBe("lobby");
    act(() => {
      h.hook.result.current.create();
    });
    expect(h.hook.result.current.phase).toBe("connecting");
    h.open();
    expect(h.socket().sent).toEqual([{ type: "create_room" }]);
    h.seat("w");
    expect(h.hook.result.current.phase).toBe("waiting");
    expect(h.hook.result.current.code).toBe(CODE);
    expect(loadCurrent()).toBe(CODE);
    expect(loadSeat(CODE)).toEqual({ seat: "w", token: TOKEN });
    h.receive({ type: "opponent", state: "connected" });
    expect(h.hook.result.current.phase).toBe("playing");
  });

  it("black goes straight to playing", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.join(CODE);
    });
    h.open();
    h.seat("b");
    h.receive({ type: "opponent", state: "connected" });
    expect(h.hook.result.current.phase).toBe("playing");
    expect(h.hook.result.current.seat).toBe("b");
    expect(h.hook.result.current.canMove).toBe(false); // white to move
  });

  it("is over once the game_over message arrives, with the mine layout", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    h.receive({ type: "opponent", state: "connected" });
    h.receive({ type: "game_over", over: { view: viewAfter("w"), mines: [20, 21] } });
    expect(h.hook.result.current.phase).toBe("over");
    expect(h.hook.result.current.gameOver?.mines).toEqual([20, 21]);
  });
});

describe("moves and turn ids", () => {
  it("bumps turnId on updates only, never on snapshots, and blocks input while a move is pending", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    h.receive({ type: "opponent", state: "connected" });
    const before = h.hook.result.current.turnId;
    expect(h.hook.result.current.canMove).toBe(true);
    act(() => {
      h.hook.result.current.play(firstMove);
    });
    expect(h.socket().sent.at(-1)).toEqual({ type: "move", seq: 0, from: 12, to: 28 });
    expect(h.hook.result.current.canMove).toBe(false); // in flight
    h.receive({ type: "update", seq: 1, events: MOVE_EVENTS, view: viewAfter("w") });
    expect(h.hook.result.current.turnId).toBe(before + 1);
    expect(h.hook.result.current.lastEvents).toEqual(MOVE_EVENTS);
    h.receive({ type: "snapshot", seq: 1, view: viewAfter("w") });
    expect(h.hook.result.current.turnId).toBe(before + 1);
    expect(h.hook.result.current.lastEvents).toEqual([]);
  });

  it("shows a friendly error for a rejected move and unblocks input", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    h.receive({ type: "opponent", state: "connected" });
    act(() => {
      h.hook.result.current.play(firstMove);
    });
    h.receive({ type: "error", code: "illegal-move", message: "Illegal move" });
    expect(h.hook.result.current.error?.text).toBe("That move isn't allowed.");
    expect(h.hook.result.current.canMove).toBe(true);
    act(() => {
      h.hook.result.current.dismissError();
    });
    expect(h.hook.result.current.error).toBeNull();
  });
});

describe("private flags", () => {
  const reshuffle: EventView = { type: "Reshuffled", mineCount: 8 };

  it("persist per game and seat, and survive a reload", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    act(() => {
      h.hook.result.current.toggleFlag(30);
      h.hook.result.current.toggleFlag(31);
      h.hook.result.current.toggleFlag(31);
    });
    expect([...h.hook.result.current.flags]).toEqual([30]);
    expect(loadFlags(CODE, "w")?.squares).toEqual([30]);
    expect(loadFlags(CODE, "b")).toBeNull();
    h.hook.unmount();

    // Reload: resume with the stored token, flags come back after joined.
    const again = harness(true);
    expect(again.socket().url).toBe("ws://test");
    again.open();
    expect(again.socket().sent).toEqual([{ type: "join_room", code: CODE, token: TOKEN }]);
    again.seat("w");
    expect([...again.hook.result.current.flags]).toEqual([30]);
  });

  it("are cleared by a Reshuffled event", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    act(() => {
      h.hook.result.current.toggleFlag(30);
    });
    h.receive({
      type: "update",
      seq: 1,
      events: [...MOVE_EVENTS, reshuffle],
      view: viewAfter("w"),
    });
    expect([...h.hook.result.current.flags]).toEqual([]);
    expect(loadFlags(CODE, "w")?.squares).toEqual([]);
  });

  it("are cleared on rejoin when a reshuffle happened while away", () => {
    saveCurrent(CODE);
    saveSeat(CODE, "w", TOKEN);
    saveFlags(CODE, "w", new Set([30]), 0);
    const h = harness(true);
    h.open();
    const missed: PublicView = {
      ...viewAfter("w"),
      log: [{ color: "b", events: [reshuffle] }],
    };
    h.receive({ type: "joined", code: CODE, seat: "w", token: TOKEN, settings: SETTINGS });
    h.receive({ type: "snapshot", seq: 3, view: missed });
    expect([...h.hook.result.current.flags]).toEqual([]);
  });
});

describe("draw offers", () => {
  function ready() {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    h.receive({ type: "opponent", state: "connected" });
    return h;
  }

  it("tracks the opponent's offer, decline and lapse", () => {
    const h = ready();
    h.receive({ type: "draw", state: "offered" });
    expect(h.hook.result.current.draw).toBe("theirs");
    act(() => {
      h.hook.result.current.declineDraw();
    });
    expect(h.socket().sent.at(-1)).toEqual({ type: "draw_reply", accept: false });
    expect(h.hook.result.current.draw).toBe("none");
    h.receive({ type: "draw", state: "offered" });
    h.receive({ type: "draw", state: "lapsed" });
    expect(h.hook.result.current.draw).toBe("none");
  });

  it("accepting sends draw_reply and waits for the server to end the game", () => {
    const h = ready();
    h.receive({ type: "draw", state: "offered" });
    act(() => {
      h.hook.result.current.acceptDraw();
    });
    expect(h.socket().sent.at(-1)).toEqual({ type: "draw_reply", accept: true });
  });

  it("my offer blocks another offer until I have moved", () => {
    const h = ready();
    expect(h.hook.result.current.canOfferDraw).toBe(true);
    act(() => {
      h.hook.result.current.offerDraw();
    });
    expect(h.socket().sent.at(-1)).toEqual({ type: "draw_offer" });
    expect(h.hook.result.current.draw).toBe("mine");
    expect(h.hook.result.current.canOfferDraw).toBe(false);
    h.receive({ type: "draw", state: "declined" });
    expect(h.hook.result.current.draw).toBe("none");
    expect(h.hook.result.current.canOfferDraw).toBe(false); // must still move
    h.receive({ type: "update", seq: 1, events: MOVE_EVENTS, view: viewAfter("w") });
    expect(h.hook.result.current.canOfferDraw).toBe(true);
  });
});

describe("failures and leaving", () => {
  it("shows a failed join in the lobby and goes back", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.join(CODE);
    });
    h.open();
    h.receive({ type: "error", code: "room-not-found", message: "Room not found" });
    expect(h.hook.result.current.phase).toBe("lobby");
    expect(h.hook.result.current.lobbyError).toBe("That code doesn't match any game.");
    act(() => {
      h.hook.result.current.clearLobbyError();
    });
    expect(h.hook.result.current.lobbyError).toBeNull();
  });

  it("forgets a stored game that no longer exists", () => {
    saveCurrent(CODE);
    saveSeat(CODE, "w", TOKEN);
    const h = harness(true);
    h.open();
    h.receive({ type: "error", code: "room-not-found", message: "Room not found" });
    expect(h.hook.result.current.phase).toBe("lobby");
    expect(h.hook.result.current.lobbyError).toBe("That game no longer exists.");
    expect(loadSeat(CODE)).toBeNull();
    expect(loadCurrent()).toBeNull();
  });

  it("leave clears storage and returns to the lobby", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    act(() => {
      h.hook.result.current.leave();
    });
    expect(h.hook.result.current.phase).toBe("lobby");
    expect(loadSeat(CODE)).toBeNull();
    expect(loadCurrent()).toBeNull();
  });

  it("leaving after a takeover keeps the other tab's stored seat", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    act(() => {
      h.socket().drop(1000);
    });
    expect(h.hook.result.current.fatal).toBe("taken-over");
    act(() => {
      h.hook.result.current.leave();
    });
    expect(h.hook.result.current.phase).toBe("lobby");
    expect(loadSeat(CODE)).not.toBeNull();
  });

  it("reports the opponent leaving and the claim window", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    h.receive({ type: "opponent", state: "connected" });
    h.receive({ type: "opponent", state: "disconnected" });
    expect(h.hook.result.current.opponent).toBe("disconnected");
    h.receive({ type: "opponent", state: "claimable" });
    act(() => {
      h.hook.result.current.claimWin();
    });
    expect(h.socket().sent.at(-1)).toEqual({ type: "claim_win" });
  });

  it("shows reconnecting while the socket is down", () => {
    const h = harness();
    act(() => {
      h.hook.result.current.create();
    });
    h.open();
    h.seat("w");
    act(() => {
      h.socket().drop();
    });
    expect(h.hook.result.current.connection).toBe("reconnecting");
    expect(h.hook.result.current.phase).toBe("waiting"); // the game is still there
  });
});
