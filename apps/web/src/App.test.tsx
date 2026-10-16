import { createSeededRng } from "@chessweeper/engine";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const sq = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no square ${name}`);
  return el;
};

const openGameMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Game" }));
};

const playFirstMove = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement) => {
  await user.click(sq(container, "e2"));
  await user.click(sq(container, "e4"));
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the start position from the public view", () => {
    const { container } = render(<App rng={createSeededRng(11)} />);
    expect(container.querySelectorAll(".square")).toHaveLength(64);
    expect(container.querySelectorAll("[data-piece]")).toHaveLength(32);
    // White at the bottom: first rendered square is a8, last is h1.
    const squares = container.querySelectorAll("[data-square]");
    expect(squares[0]?.getAttribute("data-square")).toBe("a8");
    expect(squares[63]?.getAttribute("data-square")).toBe("h1");
    expect(sq(container, "e1").querySelector("[data-piece]")?.getAttribute("data-piece")).toBe(
      "wk",
    );
    expect(screen.getByTestId("mine-count")).toHaveTextContent("8");
    expect(screen.getByTestId("reshuffle-count")).toHaveTextContent("8");
    expect(screen.getByTestId("lives-w")).toHaveTextContent("3");
    expect(screen.getByTestId("lives-b")).toHaveTextContent("3");
    // No mine marker and no number before anything is revealed.
    expect(container.querySelector("[data-mine]")).toBeNull();
    expect(container.querySelector("[data-number]")).toBeNull();
  });

  it("shows legal dots, plays a move, then hides the board behind the handoff", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await user.click(sq(container, "e2"));
    expect(container.querySelectorAll("[data-destination]")).toHaveLength(2);
    await user.click(sq(container, "e4"));
    expect(screen.getByText("Pass to Black")).toBeInTheDocument();
    expect(container.querySelector(".board")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).not.toBeNull();
    expect(screen.getByTestId("status-turn")).toHaveTextContent("Black to move");
  });

  it("flag mode and right-click keep flags private to the side to move", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await user.pointer({ keys: "[MouseRight]", target: sq(container, "d4") });
    expect(sq(container, "d4")).toHaveAttribute("data-flagged", "true");
    await user.click(sq(container, "e2"));
    await user.click(sq(container, "e3"));
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector("[data-flagged]")).toBeNull();
  });

  it("resigns and shows the game-over dialog with every mine", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await openGameMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Resign" }));
    expect(screen.getByTestId("gameover-result")).toHaveTextContent("Black wins");
    expect(screen.getByTestId("gameover-reason")).toHaveTextContent("resignation");
    expect(screen.getByTestId("gameover-mines")).toHaveTextContent("Mines (8)");
    expect(container.querySelectorAll("[data-mine]")).toHaveLength(8);
  });

  it("keeps the orientation until the handoff is dismissed, then follows the side to move", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "w");
    await playFirstMove(user, container);
    // The board is hidden entirely during the handoff, so nothing can flip in view.
    expect(container.querySelector(".board")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "b");
    const squares = container.querySelectorAll("[data-square]");
    expect(squares[0]?.getAttribute("data-square")).toBe("h1");
    expect(squares[63]?.getAttribute("data-square")).toBe("a8");
  });

  it("maps clicks correctly on a flipped board", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await playFirstMove(user, container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    await user.click(sq(container, "e7"));
    const dots = [...container.querySelectorAll("[data-destination]")].map((el) =>
      el.getAttribute("data-square"),
    );
    expect(dots.sort()).toEqual(["e5", "e6"]);
    await user.click(sq(container, "e5"));
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "w");
    expect(container.querySelector('[data-square="e5"] [data-piece]')).toHaveAttribute(
      "data-piece",
      "bp",
    );
  });

  it("keeps White at the bottom when Flip board is off, and remembers the setting", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await openGameMenu(user);
    const flipItem = screen.getByRole("menuitemcheckbox", { name: "Flip board" });
    expect(flipItem).toHaveAttribute("aria-checked", "true");
    await user.click(flipItem);
    expect(localStorage.getItem("chessweeper.flip")).toBe("0");
    await playFirstMove(user, container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "w");
  });

  it("starts with Flip off when the saved setting says so", async () => {
    localStorage.setItem("chessweeper.flip", "0");
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await playFirstMove(user, container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "w");
  });

  it("works when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await openGameMenu(user);
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Flip board" }));
    await playFirstMove(user, container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(container.querySelector(".board")).toHaveAttribute("data-orientation", "w");
  });

  it("toggles sound from the Game menu", async () => {
    const user = userEvent.setup();
    render(<App rng={createSeededRng(11)} />);
    await openGameMenu(user);
    expect(screen.getByRole("menuitemcheckbox", { name: "Sound" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Sound" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Sound" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Sound" }));
  });

  it("slides the moved piece for the next player, and not under reduced motion", async () => {
    const user = userEvent.setup();
    const first = render(<App rng={createSeededRng(11)} />);
    await playFirstMove(user, first.container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(first.container.querySelector(".fx-slide")).not.toBeNull();
    first.unmount();

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const second = render(<App rng={createSeededRng(11)} />);
    await playFirstMove(user, second.container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(second.container.querySelector(".fx-slide")).toBeNull();
  });

  it("shows the move log, newest last, and the Moves item focuses it", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await playFirstMove(user, container);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await openGameMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Moves" }));
    expect(screen.getByRole("region", { name: "Moves" })).toHaveFocus();
  });
});
