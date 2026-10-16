import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  outputDir: "test-results",
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "pnpm exec vite preview",
    url: "http://localhost:4173",
    reuseExistingServer: false,
  },
});
