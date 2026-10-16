import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpritesPage } from "./SpritesPage";

describe("SpritesPage", () => {
  it("renders every labelled section", () => {
    const { container } = render(<SpritesPage />);
    for (const name of [
      /^Pieces/,
      /^Tile states/,
      /^Numbers/,
      /^Flag, mine/,
      /^Smileys/,
      /^LED digits/,
      /^Buttons/,
      /^Dialog chrome/,
      /^Icons/,
      /^Palette/,
      /^Sample board/,
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-testid^="sample-board-"]')).toHaveLength(3);
    expect(container.querySelector('[data-swatch="1"]')).toHaveTextContent("#0000FF");
    expect(screen.getAllByRole("img", { name: "LED 042" })).toHaveLength(9);
  });
});
