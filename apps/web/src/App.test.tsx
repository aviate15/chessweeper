import { createSeededRng } from "@chessweeper/engine";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const sq = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no square ${name}`);
  return el;
};

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
    expect(screen.getByTestId("reshuffle-count")).toHaveTextContent("10");
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
    await user.click(screen.getByRole("button", { name: "Resign" }));
    expect(screen.getByTestId("gameover-result")).toHaveTextContent("Black wins");
    expect(screen.getByTestId("gameover-reason")).toHaveTextContent("resignation");
    expect(screen.getByTestId("gameover-mines")).toHaveTextContent("Mines (8)");
    expect(container.querySelectorAll("[data-mine]")).toHaveLength(8);
  });
});
