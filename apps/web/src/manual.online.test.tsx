import {
  configFromSettings,
  createGame,
  createSeededRng,
  toPublicView,
  type Square,
} from "@chessweeper/engine";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { OnlineClient, type SocketLike } from "./online/client";
import { FakeSocket, FakeTimers } from "./online/testkit";

// 3.10 Manual mine mode: online client behaviour against fake server messages
// M-C-RECONCILE: message shapes follow packages/protocol; the real server is M-C's.

const CODE = "ABCDEF";
const SETTINGS = { reshuffleInterval: 10, densityPercent: 30, mode: "manual" } as const;
const state = createGame({
  rng: createSeededRng(7),
  config: configFromSettings(SETTINGS),
});

const ready = (w: boolean, b: boolean) => ({ w, b });
const placingView = (own: Square[], r = ready(false, false)) => ({
  ...toPublicView(state, "w"),
  settings: SETTINGS,
  phase: { kind: "placement" as const, round: 1, quota: 5, ready: r },
  placement: { quota: 5, ready: r, own },
});
const playView = () => ({
  ...toPublicView(state, "w"),
  settings: SETTINGS,
  mineCount: 10,
  phase: { kind: "play" as const },
  placement: null,
});

function setup() {
  const sockets: FakeSocket[] = [];
  const timers = new FakeTimers();
  const createOnlineClient = () =>
    new OnlineClient({
      url: "ws://test",
      timers,
      createSocket: (url): SocketLike => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s;
      },
    });
  const user = userEvent.setup();
  const utils = render(<App rng={createSeededRng(11)} createOnlineClient={createOnlineClient} />);
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
  const sq = (name: string): HTMLElement => {
    const el = utils.container.querySelector<HTMLElement>(`[data-square="${name}"]`);
    if (!el) throw new Error(`no square ${name}`);
    return el;
  };
  const join = async () => {
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "Online..." }));
    await user.type(screen.getByLabelText("Invite code"), CODE);
    await user.click(screen.getByRole("button", { name: "Join game" }));
    act(() => {
      socket().open();
    });
    receive({ type: "joined", code: CODE, seat: "w", token: "tok_en-1", settings: SETTINGS });
    receive({ type: "snapshot", seq: 0, view: placingView([]) });
    receive({ type: "placement", round: 1, msLeft: 20_000 });
    receive({ type: "opponent", state: "connected" });
  };
  return { ...utils, user, socket, receive, sq, join };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chessweeper.rulesHidden", "1");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("online Manual mine placement", () => {
  it("the creator's mode choice is sent with create_room and shown in the waiting room", async () => {
    const t = setup();
    await t.user.click(screen.getByRole("button", { name: "Game" }));
    await t.user.click(screen.getByRole("menuitem", { name: "Online..." }));
    await t.user.selectOptions(screen.getByLabelText("Mine mode"), "manual");
    await t.user.click(screen.getByRole("button", { name: "Create game" }));
    act(() => {
      t.socket().open();
    });
    expect(t.socket().sent).toEqual([{ type: "create_room", settings: SETTINGS }]);
    t.receive({ type: "joined", code: CODE, seat: "w", token: "tok_en-1", settings: SETTINGS });
    t.receive({ type: "snapshot", seq: 0, view: placingView([]) });
    const room = screen.getByRole("dialog", { name: "Waiting room" });
    expect(within(room).getByTestId("waiting-settings")).toHaveTextContent("Manual mine mode");
  });

  it("shows the placement screen with a countdown from the server's msLeft", async () => {
    const t = setup();
    await t.join();
    expect(screen.getByText("Place your mines")).toBeInTheDocument();
    expect(screen.getByTestId("placement-countdown")).toHaveTextContent("20");
    expect(screen.getByTestId("placement-quota")).toHaveTextContent("of 5");
    expect(screen.getByTestId("status-settings")).toHaveTextContent("Manual");
    expect(screen.getByTestId("status-you")).toHaveTextContent("White");
    expect(screen.getByText("Opponent placing...")).toBeInTheDocument();
  });

  it("sends place, unplace and placement_done, and locks after Done", async () => {
    const t = setup();
    await t.join();
    await t.user.click(t.sq("e4"));
    expect(t.socket().sent).toContainEqual({ type: "place", sq: 28 });
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("1");
    expect(t.sq("e4")).toHaveAttribute("data-mine-kind", "w");
    await t.user.click(t.sq("e4"));
    expect(t.socket().sent).toContainEqual({ type: "unplace", sq: 28 });
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("0");
    await t.user.click(t.sq("d4"));
    await t.user.click(screen.getByRole("button", { name: "Done" }));
    expect(t.socket().sent).toContainEqual({ type: "placement_done" });
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    // A locked board sends nothing more.
    const count = t.socket().sent.length;
    await t.user.click(t.sq("c4"));
    expect(t.socket().sent).toHaveLength(count);
  });

  it("does not send a sixth placement and explains why", async () => {
    const t = setup();
    await t.join();
    for (const name of ["a3", "b3", "c3", "d3", "e3"]) await t.user.click(t.sq(name));
    const count = t.socket().sent.length;
    await t.user.click(t.sq("f3"));
    expect(t.socket().sent).toHaveLength(count);
    expect(screen.getByTestId("status-narration")).toHaveTextContent("You have placed all 5");
  });

  it("applies the server's own draft and shows when the opponent is ready", async () => {
    const t = setup();
    await t.join();
    t.receive({ type: "snapshot", seq: 1, view: placingView([20, 21], ready(false, true)) });
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("2");
    expect(t.sq("e3")).toHaveAttribute("data-mine-kind", "w");
    expect(screen.getByText("Opponent ready")).toBeInTheDocument();
  });

  it("shows a friendly message for a placement error and rolls back the optimistic mark", async () => {
    const t = setup();
    await t.join();
    await t.user.click(t.sq("e4"));
    t.receive({ type: "error", code: "bad-square", message: "That square cannot hold a mine" });
    expect(screen.getByRole("alert")).toHaveTextContent("A mine can't go on that square.");
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("0");
  });

  it("ends the round: the board returns and only I am told about my random fill", async () => {
    const t = setup();
    await t.join();
    t.receive({
      type: "update",
      seq: 1,
      events: [
        { type: "MinesAutoPlaced", color: "w", count: 3 },
        { type: "PlacementEnded", mineCount: 10 },
      ],
      view: playView(),
    });
    expect(screen.queryByText("Place your mines")).toBeNull();
    expect(screen.getByTestId("mine-count")).toHaveTextContent("10");
    expect(screen.getByTestId("status-narration")).toHaveTextContent(
      "3 mines were placed at random for you",
    );
  });

  it("ignores another seat's MinesAutoPlaced", async () => {
    const t = setup();
    await t.join();
    t.receive({
      type: "update",
      seq: 1,
      events: [
        { type: "MinesAutoPlaced", color: "b", count: 4 },
        { type: "PlacementEnded", mineCount: 10 },
      ],
      view: playView(),
    });
    expect(screen.queryByText(/placed at random/)).toBeNull();
  });

  it("shows who placed each mine when the game ends", async () => {
    const t = setup();
    await t.join();
    t.receive({
      type: "game_over",
      over: {
        view: {
          ...playView(),
          status: { kind: "over", result: "b", reason: "resignation" },
        },
        mines: [28, 29, 30],
        owned: { w: [28, 29], b: [29, 30] },
      },
    });
    expect(t.sq("e4")).toHaveAttribute("data-mine-kind", "w");
    expect(t.sq("f4")).toHaveAttribute("data-mine-kind", "big");
    expect(t.sq("g4")).toHaveAttribute("data-mine-kind", "b");
  });
});
