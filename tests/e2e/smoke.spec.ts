import { expect, test } from "@playwright/test";

/**
 * Smoke tests — require a running server. Either:
 *   PLAYWRIGHT_BASE_URL=https://preview.example  pnpm test:e2e
 * or let Playwright start one (needs `pnpm build` first):
 *   PLAYWRIGHT_WEBSERVER=1 pnpm test:e2e
 * Without either, this file skips itself so `playwright test` stays green.
 */
const hasServer = Boolean(process.env.PLAYWRIGHT_BASE_URL || process.env.PLAYWRIGHT_WEBSERVER);

test.describe("smoke", () => {
  test.skip(!hasServer, "No server configured (set PLAYWRIGHT_BASE_URL or PLAYWRIGHT_WEBSERVER=1)");

  test("landing page renders the venture intro", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FitArchive/);
    await expect(page.getByRole("heading", { name: /overlooked fashion/i })).toBeVisible();
  });

  test("health endpoint reports ok with build metadata", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("buildTime");
  });

  test("studio shell renders; research inbox is a real module (red-team H2)", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible();
    // The research inbox shipped in Phase 2 — it must NOT show the old
    // "Planned — Phase 2" placeholder anymore (unconfigured mode renders the
    // honest Connect-Supabase state for the same module).
    await page.goto("/studio/research");
    await expect(
      page.getByText(/research inbox/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/planned — phase 2/i)).toHaveCount(0);
  });
});
