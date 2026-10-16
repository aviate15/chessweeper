import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Square, type SquareProps } from "./Square";

const base: SquareProps = {
  square: 20,
  piece: null,
  number: 3,
  crater: false,
  selected: false,
  destination: false,
  lastMove: false,
  check: false,
  flagged: false,
  mine: false,
  fx: undefined,
  fxKey: 0,
  onClick: () => undefined,
  onContextMenu: () => undefined,
};

describe("Square number badge", () => {
  it("draws the full-size number on an empty square", () => {
    const { container } = render(<Square {...base} />);
    expect(container.querySelector(".layer-badge")).toBeNull();
    expect(container.querySelectorAll(".px.layer").length).toBeGreaterThan(1);
  });

  it("draws a corner badge instead when a piece stands on the square", () => {
    const { container } = render(<Square {...base} piece={{ color: "w", type: "n" }} />);
    expect(container.querySelectorAll(".layer-badge")).toHaveLength(1);
  });

  it("draws no badge for a zero or a hidden square", () => {
    const piece = { color: "b", type: "q" } as const;
    expect(
      render(<Square {...base} piece={piece} number={0} />).container.querySelector(".layer-badge"),
    ).toBeNull();
    expect(
      render(<Square {...base} piece={piece} number={null} />).container.querySelector(
        ".layer-badge",
      ),
    ).toBeNull();
  });
});
