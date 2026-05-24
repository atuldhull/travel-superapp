/**
 * Playwright E2E for the public /help page ([I6]).
 *
 * Tests the "I'm stuck and need docs" user journey. No auth, no
 * dynamic data, perfect smoke for the full pipeline.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('help page', () => {
  test('renders + h1 visible', async ({ page }) => {
    const resp = await page.goto('/help');
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('axe-clean (no serious/critical)', async ({ page }) => {
    await page.goto('/help');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });

  // See landing.spec.ts — `test.fixme` until the first Linux CI
  // run with `--update-snapshots` produces the baseline.
  test.fixme('visual: full-page baseline', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('help-page.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
