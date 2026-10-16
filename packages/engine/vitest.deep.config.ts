import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@chessweeper/engine (deep perft)",
    include: ["src/**/*.deep.test.ts"],
    testTimeout: 30 * 60 * 1000,
  },
});
