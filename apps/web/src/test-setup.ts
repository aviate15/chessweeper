import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// The rules page opens on first load; tests start with it dismissed unless they clear this key.
beforeEach(() => {
  localStorage.setItem("chessweeper.rulesHidden", "1");
});

afterEach(() => {
  cleanup();
});
