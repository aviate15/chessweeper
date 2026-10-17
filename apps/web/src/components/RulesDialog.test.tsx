// 3.7, 3.10 The Rules page words the reshuffle by mode.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RulesDialog } from "./RulesDialog";

afterEach(cleanup);

describe("Rules dialog reshuffle wording", () => {
  it("Manual mode: every N turns, captures or not", () => {
    render(
      <RulesDialog
        settings={{ reshuffleInterval: 10, densityPercent: 30, mode: "manual" }}
        onClose={() => undefined}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Rules" });
    expect(dialog).toHaveTextContent("Every 10 turns (counting both players), captures or not");
    expect(dialog).not.toHaveTextContent("without a capture");
  });

  it("Auto mode keeps the capture reset wording", () => {
    render(
      <RulesDialog
        settings={{ reshuffleInterval: 6, densityPercent: 30 }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Rules" })).toHaveTextContent(
      "After 6 turns in a row without a capture",
    );
  });
});
