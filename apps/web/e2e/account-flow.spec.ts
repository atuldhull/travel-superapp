/**
 * Authenticated E2E — /account reachable with logged-in user ([K3]).
 *
 * Closes the "I just signed up, can I get to my account page" loop.
 * Adds an axe-clean check on the page since /account is a settings
 * surface that legitimately needs strong a11y.
 */
import { test, expect } from '@playwright/test';
import { makeCredentials } from './helpers/auth';

test.describe('account — settings page reachable', () => {
  test('register → navigate to /account → render heading', async ({ page }) => {
    const { email, password, displayName } = makeCredentials('account');

    await page.goto('/register');
    await page.getByLabel(/email/i).last().fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    const nameField = page.getByLabel(/display\s*name/i);
    if (await nameField.count()) await nameField.first().fill(displayName);
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });

    // Navigate to /account. Hard-nav goes through the refresh-cookie
    // handoff which the web does on boot; protected route still
    // resolves.
    await page.goto('/account');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('/account is axe-clean for an authed user', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const { email, password, displayName } = makeCredentials('account-axe');

    // Quick UI signup to get a session into the browser context.
    await page.goto('/register');
    await page.getByLabel(/email/i).last().fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    const nameField = page.getByLabel(/display\s*name/i);
    if (await nameField.count()) await nameField.first().fill(displayName);
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();
    await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });

    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});
