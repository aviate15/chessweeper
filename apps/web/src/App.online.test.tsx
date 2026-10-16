import {
  createGame,
  createSeededRng,
  legalMoves,
  projectEvents,
  toGameOverView,
  toPublicView,
  tryEndGame,
  tryResolveMove,
} from "@chessweeper/engine";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { OnlineClient, type SocketLike } from "./online/client";
import { loadCurrent, loadSeat } from "./online/storage";
import { FakeSocket, FakeTimers } from "./online/testkit";

const CODE = "ABCDEF";
const TOKEN = "tok_en-123";

const start = createGame({ rng: createSeededRng(7) });
const e4 = legalMoves(start.position).find((m) => m.from === 12 && m.to === 28);
if (!e4) throw new Error("e2e4 missing");
const afterE4 = tryResolveMove(start, e4, createSeededRng(7));
if (!afterE4.ok) throw new Error("move failed");
const E4_EVENTS = projectEvents(afterE4.resolution.events);
const ended = tryEndGame(start, { reason: "resignation", by: "b" });
if (!ended.ok) throw new Error("end failed");

type Seat = "w" | "b";

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
  const open = () => {
    act(() => {
      socket().open();
    });
  };
  const sq = (name: string): HTMLElement => {
    const el = utils.container.querySelector<HTMLElement>(`[data-square="${name}"]`);
    if (!el) throw new Error(`no square ${name}`);
    return el;
  };
  const openLobby = async () => {
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "Online..." }));
  };
  const join = async (seat: Seat) => {
    await openLobby();
    await user.type(screen.getByLabelText("Invite code"), "abc def");
    await user.click(screen.getByRole("button", { name: "Join game" }));
    open();
    receive({ type: "joined", code: CODE, seat, token: TOKEN });
    receive({ type: "snapshot", seq: 0, view: toPublicView(start, seat) });
    receive({ type: "opponent", state: "connected" });
  };
  const create = async () => {
    await openLobby();
    await user.click(screen.getByRole("button", { name: "Create game" }));
    open();
    receive({ type: "joined", code: CODE, seat: "w", token: TOKEN });
    receive({ type: "snapshot", seq: 0, view: toPublicView(start, "w") });
  };
  const menu = async (item: string) => {
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: item }));
  };
  return { ...utils, user, socket, receive, open, sq, join, create, openLobby, menu, sockets };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chessweeper.rulesHidden", "1");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("lobby", () => {
  it("normalizes the code as you type and enables Join only for a full valid code", async () => {
    const t = setup();
    await t.openLobby();
    const input = screen.getByLabelText("Invite code");
    const join = screen.getByRole("button", { name: "Join game" });
    expect(join).toBeDisabled();
    await t.user.type(input, "abc d");
    expect(input).toHaveValue("ABCD");
    expect(join).toBeDisabled();
    await t.user.type(input, "ef");
    expect(input).toHaveValue("ABCDEF");
    expect(join).toBeEnabled();
    await t.user.clear(input);
    await t.user.type(input, "ABCDE0"); // 0 is not in the alphabet
    expect(join).toBeDisabled();
  });

  it("sends join_room with the normalized code", async () => {
    const t = setup();
    await t.openLobby();
    await t.user.type(screen.getByLabelText("Invite code"), " abc def ");
    await t.user.click(screen.getByRole("button", { name: "Join game" }));
    t.open();
    expect(t.socket().sent).toEqual([{ type: "join_room", code: CODE }]);
  });

  it("opens with the code filled in from ?join=CODE", () => {
    window.history.replaceState(null, "", "/?join=abcdef");
    setup();
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
    expect(screen.getByLabelText("Invite code")).toHaveValue(CODE);
    expect(window.location.search).toBe("");
  });

  it("shows a friendly error when the code matches no game", async () => {
    const t = setup();
    await t.openLobby();
    await t.user.type(screen.getByLabelText("Invite code"), CODE);
    await t.user.click(screen.getByRole("button", { name: "Join game" }));
    t.open();
    t.receive({ type: "error", code: "room-not-found", message: "Room not found" });
    expect(screen.getByRole("alert")).toHaveTextContent("That code doesn't match any game.");
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
  });
});

describe("waiting room", () => {
  it("shows the code with copy buttons, then cancels back to the lobby", async () => {
    const t = setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await t.create();
    expect(t.socket().sent).toEqual([{ type: "create_room" }]);
    const room = screen.getByRole("dialog", { name: "Waiting room" });
    expect(within(room).getByTestId("invite-code")).toHaveTextContent(CODE);
    expect(within(room).getByText("Waiting for opponent...")).toBeInTheDocument();
    await t.user.click(within(room).getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith(CODE);
    await t.user.click(within(room).getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(`?join=${CODE}`));
    await t.user.click(within(room).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Waiting room" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
    expect(loadSeat(CODE)).toBeNull();
    expect(loadCurrent()).toBeNull();
  });

  it("closes when the opponent joins", async () => {
    const t = setup();
    await t.create();
    t.receive({ type: "opponent", state: "connected" });
    expect(screen.queryByRole("dialog", { name: "Waiting room" })).toBeNull();
  });
});

describe("online play", () => {
  it("fixes black at the bottom, with no handoff, and blocks play on white's turn", async () => {
    const t = setup();
    await t.join("b");
    const squares = t.container.querySelectorAll("[data-square]");
    expect(squares[0]?.getAttribute("data-square")).toBe("h1");
    expect(squares[63]?.getAttribute("data-square")).toBe("a8");
    expect(screen.getByTestId("status-you")).toHaveTextContent("You: Black");
    // It is white's turn: black cannot even pick up a piece.
    await t.user.click(t.sq("e7"));
    expect(t.container.querySelectorAll("[data-destination]")).toHaveLength(0);
    // White moves; the board stays put and now black can move. No handoff screen.
    t.receive({
      type: "update",
      seq: 1,
      events: E4_EVENTS,
      view: toPublicView(afterE4.resolution.state, "b"),
    });
    expect(screen.queryByText(/Pass to/)).toBeNull();
    expect(t.container.querySelector("[data-square]")?.getAttribute("data-square")).toBe("h1");
    await t.user.click(t.sq("e7"));
    expect(t.container.querySelectorAll("[data-destination]")).toHaveLength(2);
  });

  it("sends a move with the current seq, and waits for the server before showing it", async () => {
    const t = setup();
    await t.join("w");
    await t.user.click(t.sq("e2"));
    await t.user.click(t.sq("e4"));
    expect(t.socket().sent.at(-1)).toEqual({ type: "move", seq: 0, from: 12, to: 28 });
    expect(t.sq("e4").querySelector("[data-piece]")).toBeNull(); // no optimistic move
    expect(screen.queryByText(/Pass to/)).toBeNull();
    t.receive({
      type: "update",
      seq: 1,
      events: E4_EVENTS,
      view: toPublicView(afterE4.resolution.state, "w"),
    });
    expect(t.sq("e4").querySelector("[data-piece]")?.getAttribute("data-piece")).toBe("wp");
  });

  it("keeps flags private to this seat and in storage", async () => {
    const t = setup();
    await t.join("w");
    await t.user.pointer({ keys: "[MouseRight]", target: t.sq("e4") });
    expect(
      JSON.parse(localStorage.getItem(`chessweeper.online.flags.${CODE}.w`) ?? "{}"),
    ).toMatchObject({
      squares: [28],
    });
    expect(t.socket().sent.every((m) => (m as { type: string }).type !== "flag")).toBe(true);
  });

  it("shows friendly server errors, not raw ones", async () => {
    const t = setup();
    await t.join("w");
    t.receive({ type: "error", code: "rate-limited", message: "Too many requests" });
    expect(screen.getByRole("alert")).toHaveTextContent("Slow down a little and try again.");
  });
});

describe("confirm dialogs", () => {
  it("resign needs a confirmation", async () => {
    const t = setup();
    await t.join("w");
    const before = t.socket().sent.length;
    await t.menu("Resign");
    const dialog = screen.getByRole("dialog", { name: "Resign" });
    await t.user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(t.socket().sent).toHaveLength(before);
    await t.menu("Resign");
    await t.user.click(
      within(screen.getByRole("dialog", { name: "Resign" })).getByRole("button", {
        name: "Resign",
      }),
    );
    expect(t.socket().sent.at(-1)).toEqual({ type: "resign" });
  });

  it("offers, accepts and declines draws with confirmation", async () => {
    const t = setup();
    await t.join("w");
    await t.menu("Offer draw");
    await t.user.click(
      within(screen.getByRole("dialog", { name: "Offer draw" })).getByRole("button", {
        name: "Offer draw",
      }),
    );
    expect(t.socket().sent.at(-1)).toEqual({ type: "draw_offer" });
    expect(screen.getByText("Draw offered. Waiting for an answer...")).toBeInTheDocument();
    t.receive({ type: "draw", state: "declined" });

    t.receive({ type: "draw", state: "offered" });
    await t.user.click(screen.getByRole("button", { name: "Decline draw" }));
    await t.user.click(
      within(screen.getByRole("dialog", { name: "Decline draw" })).getByRole("button", {
        name: "Decline draw",
      }),
    );
    expect(t.socket().sent.at(-1)).toEqual({ type: "draw_reply", accept: false });

    t.receive({ type: "draw", state: "offered" });
    await t.user.click(screen.getByRole("button", { name: "Accept draw" }));
    await t.user.click(
      within(screen.getByRole("dialog", { name: "Accept draw" })).getByRole("button", {
        name: "Accept draw",
      }),
    );
    expect(t.socket().sent.at(-1)).toEqual({ type: "draw_reply", accept: true });
  });

  it("leaving a running game asks to resign first", async () => {
    const t = setup();
    await t.join("w");
    await t.menu("Leave game");
    const dialog = screen.getByRole("dialog", { name: "Leave game" });
    await t.user.click(within(dialog).getByRole("button", { name: "Resign and leave" }));
    expect(t.socket().sent.at(-1)).toEqual({ type: "resign" });
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
    expect(loadSeat(CODE)).toBeNull();
  });
});

describe("connection banners", () => {
  it("shows reconnecting, then recovers", async () => {
    const t = setup();
    await t.join("w");
    act(() => {
      t.socket().drop();
    });
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    // Moves are blocked while the socket is down.
    await t.user.click(t.sq("e2"));
    expect(t.container.querySelectorAll("[data-destination]")).toHaveLength(0);
  });

  it("shows opponent disconnected, then claim win after the grace", async () => {
    const t = setup();
    await t.join("w");
    t.receive({ type: "opponent", state: "disconnected" });
    expect(screen.getByText(/Opponent disconnected/)).toBeInTheDocument();
    t.receive({ type: "opponent", state: "claimable" });
    await t.user.click(screen.getByRole("button", { name: "Claim win" }));
    await t.user.click(
      within(screen.getByRole("dialog", { name: "Claim win" })).getByRole("button", {
        name: "Claim win",
      }),
    );
    expect(t.socket().sent.at(-1)).toEqual({ type: "claim_win" });
  });

  it("offers Back to lobby when the seat was taken over in another tab", async () => {
    const t = setup();
    await t.join("w");
    act(() => {
      t.socket().drop(1000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("opened in another tab");
    await t.user.click(screen.getByRole("button", { name: "Back to lobby" }));
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
    expect(loadSeat(CODE)).not.toBeNull(); // the other tab still owns it
  });
});

describe("game over", () => {
  it("reveals the mines and the reason, then goes back to the lobby", async () => {
    const t = setup();
    await t.join("w");
    const view = toPublicView(ended.resolution.state, "w");
    const over = toGameOverView(ended.resolution.state, "w");
    if (!over) throw new Error("no game over view");
    t.receive({ type: "update", seq: 1, events: projectEvents(ended.resolution.events), view });
    t.receive({ type: "game_over", over });
    const dialog = screen.getByRole("dialog", { name: "Game over" });
    expect(within(dialog).getByTestId("gameover-reason")).toHaveTextContent("resignation");
    expect(within(dialog).getByTestId("gameover-mines")).toHaveTextContent(
      `Mines (${String(over.mines.length)})`,
    );
    expect(within(dialog).queryByRole("button", { name: "New game" })).toBeNull();
    await t.user.click(within(dialog).getByRole("button", { name: "Back to lobby" }));
    expect(screen.getByRole("dialog", { name: "Online" })).toBeInTheDocument();
    expect(loadCurrent()).toBeNull();
  });
});
