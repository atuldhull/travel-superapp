/**
 * Authenticated user-flow E2E — signup → access /trips/new ([J5]).
 *
 * Proves the full "I just signed up and want to plan something"
 * journey works end-to-end:
 *
 *   1. Register via the UI → access token in memory + refresh
 *      cookie on the response
 *   2. Soft-navigate to /trips → page loads (proves the protected
 *      route honors the session)
 *   3. Soft-navigate to /trips/new → composer page renders
 *
 * Why not also DRIVE the trip-create form? The composer is a complex
 * multi-step UI (map picker, continent picker, AI planner button)
 * that's better tested at the COMPONENT level. The E2E target here
 * is "can I get from the registration form to a working planner
 * page" — the highest-signal authenticated journey for a fresh user.
 */
import { test, expect } from '@playwright/test';
import { makeCredentials } from './helpers/auth';

test.describe('trip — post-signup access to the planner', () => {
  test('register → reach /trips/new', async ({ page }) => {
    const { email, password, displayName } = makeCredentials('trip-flow');

    // Step 1: register.
    await page.goto('/register');
    await page.getByLabel(/email/i).last().fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    const nameField = page.getByLabel(/display\s*name/i);
    if (await nameField.count()) await nameField.first().fill(displayName);
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    // Step 2: landed on /trips post-signup.
    await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // Step 3: navigate to /trips/new. Soft-nav via Link/Button so
    // the in-memory access token survives — a `page.goto('/trips/new')`
    // here would force a hard reload, drop the token, and either
    // bounce to /login or 401 on the first SDK call (depending on
    // the refresh-cookie handoff).
    const newTripLink = page.getByRole('link', { name: /new trip|plan|create/i }).first();
    if (await newTripLink.count()) {
      await newTripLink.click();
      await page.waitForURL(/\/trips\/new/, { timeout: 10_000 });
    } else {
      // Fallback: hit /trips/new directly. The web does a /refresh
      // round-trip on boot to re-acquire the access token from the
      // httpOnly cookie, so the protected route still resolves.
      await page.goto('/trips/new');
    }

    // Composer page heading: "Plan a new trip" / "New trip" / etc.
    // We don't depend on exact copy — any h1/h2 is enough proof.
    await expect(
      page
        .getByRole('heading')
        .filter({ hasText: /trip|plan/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
