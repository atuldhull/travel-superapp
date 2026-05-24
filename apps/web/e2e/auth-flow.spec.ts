/**
 * Authenticated user-flow E2E — signup → post-signup destination ([J5]).
 *
 * Tests the "real user journey" the review explicitly called out:
 * fill the register form, submit, follow the redirect, prove the
 * session is live. Drives entirely through the UI (no API shortcuts)
 * so the form wiring + token handoff + post-auth navigation are all
 * exercised end-to-end.
 *
 * Companion flow tests follow the same pattern — sign up once, then
 * exercise whatever the test actually wants (trip create, expense,
 * etc.) via Next's soft-navigation so the in-memory access token
 * survives between routes.
 */
import { test, expect } from '@playwright/test';
import { makeCredentials } from './helpers/auth';

test.describe('auth — signup → redirect', () => {
  test('email + password registration lands on /trips', async ({ page }) => {
    const { email, password, displayName } = makeCredentials('signup');

    await page.goto('/register');

    // The page surfaces magic-link ABOVE the password form, so the
    // password fields aren't the first email input — match by label
    // to be unambiguous.
    await page.getByLabel(/email/i).last().fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    // displayName may be optional; fill if present.
    const nameField = page.getByLabel(/display\s*name/i);
    if (await nameField.count()) {
      await nameField.first().fill(displayName);
    }

    // Submit the password registration form (NOT the magic-link one).
    // The form's submit button has "Create account" / "Sign up" /
    // "Register" copy — match permissively.
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    // Post-auth destination is /trips by default (decidePostAuthDestination).
    await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/trips/);
  });

  test('register page is axe-clean', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    await page.goto('/register');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});
