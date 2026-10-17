import {
  DEFAULT_SETTINGS,
  createGame,
  createSeededRng,
  toPublicView,
  type PublicView,
} from "@chessweeper/engine";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./Board";
import { HandoffScreen } from "./HandoffScreen";
import { PlacementScreen } from "./PlacementScreen";
import { RulesDialog } from "./RulesDialog";
import { SettingsFields } from "./SettingsFields";
import { placementQuota, type GameMode } from "./placementTypes";

// 3.10 manual mine mode (UI building blocks)

const base = toPublicView(createGame({ rng: createSeededRng(3) }), "w");

const view = (own: number[], ready = { w: false, b: false }, quota = 5): PublicView => ({
  ...base,
  phase: { kind: "placement", round: 1, quota, ready },
  placement: { quota, ready, own },
});

const sq = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-square="${name}"]`);
  if (!el) throw new Error(`no square ${name}`);
  return el;
};

describe("placementQuota", () => {
  it("is half the starting count, rounded half up", () => {
    expect(placementQuota(30)).toBe(5); // 9.6 / 2 = 4.8
    expect(placementQuota(50)).toBe(8); // 16 / 2
    expect(placementQuota(5)).toBe(1); // 1.6 / 2 = 0.8
    expect(placementQuota(25)).toBe(4); // 8 / 2
    expect(placementQuota(15)).toBe(2); // 4.8 / 2 = 2.4
  });
});

function Harness({
  initial,
  onChange,
}: {
  initial: Parameters<typeof SettingsFields>[0]["settings"];
  onChange?: (m: GameMode | undefined, i: number) => void;
}) {
  const [s, setS] = useState(initial);
  return (
    <SettingsFields
      settings={s}
      onChange={(n) => {
        setS(n);
        onChange?.(n.mode, n.reshuffleInterval);
      }}
    />
  );
}

describe("SettingsFields mode picker", () => {
  it("is hidden when no mode is given", () => {
    render(<SettingsFields settings={DEFAULT_SETTINGS} onChange={() => undefined} />);
    expect(screen.queryByLabelText("Mine mode")).toBeNull();
    expect(screen.getByTestId("settings-mines")).toHaveTextContent("Starting mines");
  });

  it("moves an untouched interval to the new mode's default (6 -> 10 -> 6)", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    render(<Harness initial={{ ...DEFAULT_SETTINGS, mode: "auto" }} onChange={seen} />);
    await user.selectOptions(screen.getByLabelText("Mine mode"), "manual");
    expect(seen).toHaveBeenLastCalledWith("manual", 10);
    expect(screen.getByLabelText("Reshuffle every")).toHaveValue("10");
    expect(screen.getByTestId("settings-mines")).toHaveTextContent("Each player places 5 mines");
    await user.selectOptions(screen.getByLabelText("Mine mode"), "auto");
    expect(seen).toHaveBeenLastCalledWith("auto", 6);
  });

  it("keeps an interval the player changed", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    render(<Harness initial={{ ...DEFAULT_SETTINGS, mode: "auto" }} onChange={seen} />);
    await user.selectOptions(screen.getByLabelText("Reshuffle every"), "8");
    await user.selectOptions(screen.getByLabelText("Mine mode"), "manual");
    expect(seen).toHaveBeenLastCalledWith("manual", 8);
  });

  it("updates the quota line with the density", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...DEFAULT_SETTINGS, mode: "manual", reshuffleInterval: 10 }} />);
    await user.selectOptions(screen.getByLabelText("Mine density"), "50");
    expect(screen.getByTestId("settings-mines")).toHaveTextContent("Each player places 8 mines");
  });
});

describe("PlacementScreen", () => {
  it("toggles an empty square and ignores squares with pieces", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { container } = render(
      <PlacementScreen
        view={view([])}
        msLeft={null}
        onToggle={onToggle}
        onDone={vi.fn()}
        autoPlaced={null}
      />,
    );
    await user.click(sq(container, "e4"));
    expect(onToggle).toHaveBeenCalledWith(28);
    onToggle.mockClear();
    await user.click(sq(container, "e2"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(sq(container, "e2")).toBeDisabled();
  });

  it("draws the viewer's own markers in their colour", () => {
    const { container } = render(
      <PlacementScreen
        view={view([28, 29])}
        msLeft={null}
        onToggle={vi.fn()}
        onDone={vi.fn()}
        autoPlaced={null}
      />,
    );
    expect(sq(container, "e4")).toHaveAttribute("data-mine-kind", "w");
    expect(sq(container, "f4")).toHaveAttribute("data-mine-kind", "w");
    expect(sq(container, "d4")).not.toHaveAttribute("data-mine-kind");
    expect(screen.getByTestId("placement-placed")).toHaveTextContent("2");
    expect(screen.getByTestId("placement-quota")).toHaveTextContent("of 5");
  });

  it("counts down and blinks red at 5 seconds or fewer", () => {
    const props = { onToggle: vi.fn(), onDone: vi.fn(), autoPlaced: null };
    const { container, rerender } = render(
      <PlacementScreen view={view([])} msLeft={12_000} {...props} />,
    );
    expect(screen.getByTestId("placement-countdown")).toHaveTextContent("12");
    expect(container.querySelector(".led-blink")).toBeNull();
    rerender(<PlacementScreen view={view([])} msLeft={4_200} {...props} />);
    expect(screen.getByTestId("placement-countdown")).toHaveTextContent("5");
    expect(container.querySelector(".led-blink")).not.toBeNull();
  });

  it("has no countdown without a timer", () => {
    render(
      <PlacementScreen
        view={view([])}
        msLeft={null}
        onToggle={vi.fn()}
        onDone={vi.fn()}
        autoPlaced={null}
      />,
    );
    expect(screen.queryByTestId("placement-countdown")).toBeNull();
  });

  it("Done calls back, then locks the board; shows the opponent's state", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const { rerender } = render(
      <PlacementScreen
        view={view([])}
        msLeft={null}
        onToggle={vi.fn()}
        onDone={onDone}
        autoPlaced={null}
      />,
    );
    expect(screen.getByText("Opponent placing...")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledOnce();
    rerender(
      <PlacementScreen
        view={view([], { w: true, b: true })}
        msLeft={null}
        onToggle={vi.fn()}
        onDone={onDone}
        autoPlaced={null}
      />,
    );
    expect(screen.getByText("Opponent ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  });

  it("tells the player how many mines were placed at random", () => {
    const props = { view: view([]), msLeft: null, onToggle: vi.fn(), onDone: vi.fn() };
    const { rerender } = render(<PlacementScreen {...props} autoPlaced={0} />);
    expect(screen.queryByText(/placed at random/)).toBeNull();
    rerender(<PlacementScreen {...props} autoPlaced={3} />);
    expect(screen.getByText("3 mines were placed at random")).toBeInTheDocument();
  });
});

describe("Board owned layout", () => {
  it("colours mines per placer and marks big mines", () => {
    const { container } = render(
      <Board
        view={base}
        flags={new Set()}
        orientation="w"
        selected={null}
        destinations={[]}
        mines={[]}
        fx={[]}
        fxKey={0}
        owned={{ w: [28, 29], b: [29, 30] }}
        onSquareClick={() => undefined}
        onSquareFlag={() => undefined}
      />,
    );
    expect(sq(container, "e4")).toHaveAttribute("data-mine-kind", "w");
    expect(sq(container, "f4")).toHaveAttribute("data-mine-kind", "big");
    expect(sq(container, "g4")).toHaveAttribute("data-mine-kind", "b");
    expect(sq(container, "a4")).not.toHaveAttribute("data-mine");
  });
});

describe("HandoffScreen placing variant", () => {
  it("says the next player places mines", () => {
    render(<HandoffScreen to="w" placing onReady={() => undefined} />);
    expect(screen.getByText("Pass to White to place mines")).toBeInTheDocument();
  });
  it("keeps the default text", () => {
    render(<HandoffScreen to="b" onReady={() => undefined} />);
    expect(screen.getByText("Pass to Black")).toBeInTheDocument();
  });
});

describe("RulesDialog", () => {
  it("has a Manual mine mode section", () => {
    render(<RulesDialog settings={DEFAULT_SETTINGS} onClose={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Manual mine mode" })).toBeInTheDocument();
  });
});
