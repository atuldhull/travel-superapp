/**
 * Authenticated E2E — login flow ([K3]).
 *
 * Complement to `auth-flow.spec.ts` (which exercises signup): a
 * REGISTERED user signs in via /login with email + password and
 * lands on /trips. Two-step matters because MFA-enabled accounts
 * follow a different path (covered by an `mfa.e2e-spec.ts` slot —
 * future); this test exercises the no-MFA happy path.
 *
 * Setup: register via the API once (helpers/auth.registerViaApi),
 * then drive the /login UI in Chromium.
 */
import { test, expect } from '@playwright/test';
import { makeCredentials, registerViaApi } from './helpers/auth';

const API_BASE = 'http://127.0.0.1:3000';

test.describe('auth — login flow', () => {
  test('register via API → login via UI → /trips', async ({ page }) => {
    const creds = makeCredentials('login');
    await registerViaApi(API_BASE, creds);

    await page.goto('/login');
    await page.getByLabel(/email/i).first().fill(creds.email);
    await page.getByLabel(/^password$/i).fill(creds.password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();

    await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/trips/);
  });

  test('login page is axe-clean', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});
