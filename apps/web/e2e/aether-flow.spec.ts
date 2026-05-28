/**
 * Playwright E2E for the Aether preview surface ([AE51]).
 *
 * Coverage (smoke + a11y, no full create-trip mutation — that needs
 * an authed POST /trips which auth-flow.spec.ts already exercises):
 *   1. /aether/drift loads (200 + hero h1 visible).
 *   2. Navigation: Drift → Plan via the Begin-the-yatra CTA.
 *   3. /aether/destinations index loads + lists at least one card.
 *   4. /aether/atlas loads (Leaflet + canvas may not be assertable
 *      in headless, but the DriftNav + hero text are).
 *   5. axe-core finds no serious / critical violations on Drift.
 *
 * Requires `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW=1` in the web app's
 * .env.local — Playwright reuses the dev server which loads that.
 * Skipped end-to-end if the gate isn't on (Drift 404s).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('aether — drift / plan / destinations / atlas', () => {
  test('drift loads with the hero headline', async ({ page }) => {
    const resp = await page.goto('/aether/drift');
    // If the gate is off the route 404s — skip cleanly rather than fail.
    if (resp?.status() === 404) {
      test.skip(true, 'NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != 1');
      return;
    }
    expect(resp?.status()).toBeLessThan(400);
    // "Live Bharat." — the marquee h1 on Drift.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('drift → plan via begin-the-yatra CTA', async ({ page }) => {
    const resp = await page.goto('/aether/drift');
    if (resp?.status() === 404) {
      test.skip(true, 'NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != 1');
      return;
    }
    // The hero CTA is the first link/anchor with text "Begin the yatra".
    await page
      .getByRole('link', { name: /begin the yatra/i })
      .first()
      .click();
    await page.waitForURL(/\/aether\/plan/);
    expect(page.url()).toMatch(/\/aether\/plan/);
    // Plan form should mount with a Where input — match by label or
    // placeholder permissively (the field name may vary).
    const where = page
      .getByPlaceholder(/jaipur|where|place|destination/i)
      .or(page.getByLabel(/where|destination|place/i));
    await expect(where.first()).toBeVisible();
  });

  test('destinations index shows at least one card', async ({ page }) => {
    const resp = await page.goto('/aether/destinations');
    if (resp?.status() === 404) {
      test.skip(true, 'NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != 1');
      return;
    }
    // Each destination card is wrapped in an article. Tolerate the
    // marquee one + at least one more.
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible();
  });

  test('atlas loads with the masthead', async ({ page }) => {
    const resp = await page.goto('/aether/atlas');
    if (resp?.status() === 404) {
      test.skip(true, 'NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != 1');
      return;
    }
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('drift is axe-clean (no serious/critical violations)', async ({ page }) => {
    const resp = await page.goto('/aether/drift');
    if (resp?.status() === 404) {
      test.skip(true, 'NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != 1');
      return;
    }
    // Settle one beat so Leaflet / lazy bundles have mounted.
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});
