import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  outputDir: "dist/test-results",
  use: { baseURL: "http://localhost:4173" },
  webServer: [
    {
      command: "pnpm exec vite preview",
      url: "http://localhost:4173",
      reuseExistingServer: false,
    },
    {
      // The real game server, for the two-player online test.
      command: "pnpm --filter @chessweeper/server exec tsx src/main.ts",
      url: "http://127.0.0.1:8787/healthz",
      reuseExistingServer: false,
      env: { PORT: "8787", HOST: "127.0.0.1", ALLOWED_ORIGINS: "http://localhost:4173" },
    },
  ],
});
