/**
 * Playwright config for apps/web E2E tests ([I6]).
 *
 * Three responsibilities for these tests:
 *   1. Functional happy-path — load the page, assert it didn't 500,
 *      assert the headline/heading is visible.
 *   2. Accessibility — run axe-core/playwright on the rendered DOM
 *      (real browser, real CSS, real focus order — catches things
 *      jest-axe under jsdom can't).
 *   3. Visual regression — `expect(page).toHaveScreenshot()` saves
 *      a baseline in `e2e/__screenshots__/`, fails on subsequent runs
 *      if the rendered pixels diverge beyond the threshold. Reviewer
 *      accepts an intentional UI change by re-running with
 *      `--update-snapshots`.
 *
 * Web server: Playwright spawns `next dev` and waits for the port.
 * For CI hermeticity, we could swap to `pnpm build && next start`
 * once the env-var matrix for a prod build is sorted; dev mode is
 * a starter posture that lets the gate land today.
 *
 * Visual baselines are platform-sensitive (Linux Chromium != macOS
 * Chromium pixel-for-pixel), so CI runs on Linux only. Local dev
 * runs Playwright but can `--update-snapshots` from your own OS;
 * the linux baselines are the ones committed under
 * `e2e/__screenshots__/<spec>.ts-snapshots/`.
 *
 * Installed by prompt [I6].
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3001';
const HOST = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Single worker locally keeps screenshots stable; CI can parallelize.
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: HOST,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Visual-regression tolerance: tiny anti-alias diffs and font-
    // hinting drift across patch versions of Chromium can otherwise
    // flake the gate. The threshold is per-pixel; the max-diff-pixels
    // fence is the absolute number of pixels allowed to differ.
    // Tuned conservative — bump only if there's evidence of flake.
  },
  expect: {
    toHaveScreenshot: { threshold: 0.2, maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `next dev` starts faster than `next build && next start` and
    // sidesteps the prod env-var matrix. Production-mode parity is
    // a follow-up gate.
    command: 'pnpm dev',
    url: HOST,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
