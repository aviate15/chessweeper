import { DEFAULT_SETTINGS, createSeededRng } from "@chessweeper/engine";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { RulesDialog } from "./components/RulesDialog";

// 3.10 Manual mine mode: local pass-and-play placement flow

type User = ReturnType<typeof userEvent.setup>;

const MANUAL = { reshuffleInterval: 10, densityPercent: 30, mode: "manual" };

const sq = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no square ${name}`);
  return el;
};

const place = async (user: User, container: HTMLElement, squares: string[]) => {
  for (const name of squares) await user.click(sq(container, name));
};

const done = (user: User) => user.click(screen.getByRole("button", { name: "Done" }));
const ready = (user: User) => user.click(screen.getByRole("button", { name: "Ready" }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chessweeper.rulesHidden", "1");
  localStorage.setItem("chessweeper.options", JSON.stringify(MANUAL));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("local Manual mine placement", () => {
  // 3.10 placement round at game start, quota 5 each at 30%
  it("starts in a placement round: White places first, no timer, settings show the mode", () => {
    const { container } = render(<App rng={createSeededRng(4)} />);
    expect(screen.getByText("Place your mines")).toBeInTheDocument();
    expect(screen.getByTestId("placement-quota")).toHaveTextContent("of 5");
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("0");
    expect(screen.queryByTestId("placement-countdown")).toBeNull();
    expect(screen.getByTestId("status-turn")).toHaveTextContent("Placing mines");
    expect(screen.getByTestId("status-settings")).toHaveTextContent("Manual");
    expect(screen.getByText(/White: click an empty square/)).toBeInTheDocument();
    // No normal info bar and no move log while placing.
    expect(screen.queryByTestId("mine-count")).toBeNull();
    expect(container.querySelector("[data-square]")).not.toBeNull();
    // Squares with pieces cannot take a mine.
    expect(sq(container, "e2")).toBeDisabled();
  });

  // 3.10 quota: at most the quota; own placements can be taken back until Done
  it("stops at the quota with an explanation, and a placed mine can be taken back", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(4)} />);
    await place(user, container, ["a3", "b3", "c3", "d3", "e3"]);
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("5");
    await user.click(sq(container, "f3"));
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("5");
    expect(sq(container, "f3")).not.toHaveAttribute("data-mine-kind");
    expect(screen.getByTestId("status-narration")).toHaveTextContent("You have placed all 5 mines");
    await user.click(sq(container, "e3"));
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("4");
    await user.click(sq(container, "f3"));
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("5");
    expect(sq(container, "f3")).toHaveAttribute("data-mine-kind", "w");
  });

  // 3.10 local: White places, a handoff hides the board, Black places, handoff to the mover
  it("hides the board during both handoffs and never shows White's mines to Black", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(4)} />);
    await place(user, container, ["a3", "b3", "c3", "d3", "e3"]);
    await done(user);

    // The board is not in the DOM at all while the device is handed over.
    expect(screen.getByText("Pass to Black to place mines")).toBeInTheDocument();
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(container.querySelector("[data-mine-kind]")).toBeNull();

    await ready(user);
    expect(screen.getByText(/Black: click an empty square/)).toBeInTheDocument();
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("0");
    expect(container.querySelector("[data-mine-kind]")).toBeNull();
    await place(user, container, ["a6", "b6", "c6", "d6", "e6"]);
    expect(sq(container, "a6")).toHaveAttribute("data-mine-kind", "b");
    await done(user);

    // Handoff to the side to move; still no board.
    expect(screen.getByText("Pass to White")).toBeInTheDocument();
    expect(container.querySelector("[data-square]")).toBeNull();
    await ready(user);

    // Play starts: the normal board and info bar, no mine markers, and a live count of 10.
    expect(screen.getByTestId("status-turn")).toHaveTextContent("White to move");
    expect(screen.getByTestId("mine-count")).toHaveTextContent("10");
    expect(container.querySelector("[data-mine-kind]")).toBeNull();
    expect(container.querySelector("[data-mine]")).toBeNull();
    expect(screen.queryByTestId("autoplaced-notice")).toBeNull();
  });

  // 3.10 Done with fewer than the quota: the rest is placed at random, only that player is told
  it("random-fills a short Done and tells only that player how many", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(4)} />);
    await place(user, container, ["a3", "b3"]); // 2 of 5
    await done(user);
    await ready(user);
    await place(user, container, ["a6", "b6", "c6", "d6", "e6"]); // full
    await done(user);
    await ready(user);

    // White moves first and is told that 3 of their mines were placed at random.
    expect(screen.getByTestId("status-narration")).toHaveTextContent(
      "3 mines were placed at random for you",
    );
    expect(screen.getByTestId("mine-count")).toHaveTextContent("10");

    // After White moves, Black is told nothing (Black placed all 5).
    await user.click(sq(container, "e2"));
    await user.click(sq(container, "e3"));
    // The mover may hit a mine and keep the turn only via check; either way the notice is gone.
    expect(screen.queryByText(/placed at random for you/)).toBeNull();
  });

  // 3.10 resigning is allowed during placement and ends the game at once
  it("resigns during placement and shows the game-over dialog with the mine layout", async () => {
    const user = userEvent.setup();
    const { container } = render(<App rng={createSeededRng(4)} />);
    await place(user, container, ["a3", "b3"]);
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "Resign" }));
    expect(screen.getByRole("dialog", { name: /game over/i })).toBeInTheDocument();
    // The normal board is back (no placement screen) once the game is over.
    expect(screen.queryByText("Place your mines")).toBeNull();
    expect(container.querySelector("[data-square]")).not.toBeNull();
  });
});

describe("mode picker", () => {
  // 3.10 the mode is a per-game setting chosen in New game...
  it("New game... offers Auto and Manual, moves the interval default, and starts placement", async () => {
    localStorage.removeItem("chessweeper.options");
    const user = userEvent.setup();
    render(<App rng={createSeededRng(4)} />);
    expect(screen.getByTestId("reshuffle-count")).toHaveTextContent("6");
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "New game..." }));
    expect(screen.getByLabelText("Mine mode")).toHaveValue("auto");
    await user.selectOptions(screen.getByLabelText("Mine mode"), "manual");
    expect(screen.getByLabelText("Reshuffle every")).toHaveValue("10");
    expect(screen.getByTestId("settings-mines")).toHaveTextContent("Each player places 5 mines");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText("Place your mines")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("chessweeper.options") ?? "{}")).toEqual(MANUAL);
  });

  // 3.10 a missing mode means Auto: saved Auto options keep their exact old shape
  it("an Auto game saves options without a mode", async () => {
    localStorage.removeItem("chessweeper.options");
    const user = userEvent.setup();
    render(<App rng={createSeededRng(4)} />);
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "New game..." }));
    await user.selectOptions(screen.getByLabelText("Mine mode"), "manual");
    await user.selectOptions(screen.getByLabelText("Mine mode"), "auto");
    await user.selectOptions(screen.getByLabelText("Reshuffle every"), "7");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByTestId("reshuffle-count")).toHaveTextContent("7");
    expect(JSON.parse(localStorage.getItem("chessweeper.options") ?? "{}")).toEqual({
      reshuffleInterval: 7,
      densityPercent: 30,
    });
    expect(screen.queryByText("Place your mines")).toBeNull();
  });

  it("Reset to defaults goes back to Auto", async () => {
    const user = userEvent.setup();
    render(<App rng={createSeededRng(4)} />);
    await user.click(screen.getByRole("button", { name: "Game" }));
    await user.click(screen.getByRole("menuitem", { name: "New game..." }));
    expect(screen.getByLabelText("Mine mode")).toHaveValue("manual");
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByLabelText("Mine mode")).toHaveValue("auto");
    expect(screen.getByLabelText("Reshuffle every")).toHaveValue("6");
  });
});

describe("Rules text for Manual mine mode", () => {
  // 3.10 big mine blast, kings lose exactly 1 life, no safe start, quota
  it("matches the design doc and drops the Auto-only claims", () => {
    render(
      <RulesDialog settings={{ ...DEFAULT_SETTINGS, mode: "manual" }} onClose={() => undefined} />,
    );
    const text = screen.getByRole("region", { name: "Rules text" }).textContent;
    expect(text).toContain("blasts the 3x3 area");
    expect(text).toContain("loses exactly 1 life");
    expect(text).toContain("no chain reaction");
    expect(text).toContain("the player who moved loses");
    expect(text).toContain("20-second timer");
    expect(text).toContain("5 mines each");
    expect(text).toContain("no safe first move");
    expect(text).not.toContain("start hidden on ranks 3-6");
    expect(text).not.toContain("rounded half up. Mines can land");
  });

  it("keeps the Auto text for Auto games", () => {
    render(<RulesDialog settings={DEFAULT_SETTINGS} onClose={() => undefined} />);
    const text = screen.getByRole("region", { name: "Rules text" }).textContent;
    expect(text).toContain("start hidden on ranks 3-6");
    expect(text).toContain("first move of the game can never hit a mine");
  });
});
