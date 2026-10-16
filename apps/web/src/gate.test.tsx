import { createSeededRng } from "@chessweeper/engine";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

// Pretend every move has a 400 ms explosion, so the gate is exercised without a lucky seed.
vi.mock("./presentation", async (importOriginal) => {
  const original = await importOriginal<typeof import("./presentation")>();
  return { ...original, presentationFor: () => ({ blockingMs: 400, fx: [] }) };
});

const sq = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no square ${name}`);
  return el;
};

const move = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement) => {
  await user.click(sq(container, "e2"));
  await user.click(sq(container, "e4"));
};

describe("explosion gate", () => {
  it("holds the handoff back, then shows it when the effect ends", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await move(user, container);
    expect(screen.queryByText("Pass to Black")).toBeNull();
    expect(container.querySelector(".board")).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText("Pass to Black")).toBeInTheDocument();
    });
    expect(container.querySelector(".board")).toBeNull();
  });

  it("skips on a click", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await move(user, container);
    expect(screen.queryByText("Pass to Black")).toBeNull();
    await user.click(sq(container, "a1"));
    expect(screen.getByText("Pass to Black")).toBeInTheDocument();
  });

  it("skips on a key press", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await move(user, container);
    expect(screen.queryByText("Pass to Black")).toBeNull();
    await user.keyboard("{Shift}");
    expect(screen.getByText("Pass to Black")).toBeInTheDocument();
  });

  it("never blocks when the gate is off (online clients)", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} gate={false} />);
    await move(user, container);
    expect(screen.getByText("Pass to Black")).toBeInTheDocument();
  });

  it("does not show the opponent's flags while the gate holds", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(11)} />);
    await user.pointer({ keys: "[MouseRight]", target: sq(container, "d4") });
    await move(user, container);
    expect(container.querySelector("[data-flagged]")).toBeNull();
  });
});
