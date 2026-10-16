import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@chessweeper/engine",
    // Deep perft is opt-in: pnpm --filter @chessweeper/engine perft:deep
    exclude: [...configDefaults.exclude, "**/*.deep.test.ts"],
  },
});
