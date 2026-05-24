/**
 * Playwright E2E for the dedicated /accessibility statement page ([I6]).
 *
 * Two checks:
 *   1. Page exists + status 200 (regression guard against the route
 *      being accidentally removed — required for compliance posture).
 *   2. The page itself passes axe (irony otherwise).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility statement page', () => {
  test('renders + axe-clean', async ({ page }) => {
    const resp = await page.goto('/accessibility');
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});
