import { defineConfig } from "@playwright/test";

// E2E smoke tests run against a live server. Provide one via
// PLAYWRIGHT_BASE_URL (external server) or PLAYWRIGHT_WEBSERVER=1
// (this config starts `pnpm start`; requires a prior `pnpm build`).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL },
  ...(process.env.PLAYWRIGHT_WEBSERVER === "1"
    ? {
        webServer: {
          command: "pnpm start",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
