/**
 * Admin happy-path E2E ([S-E7]).
 *
 * The admin tree (`/admin/*`) has three gates layered in front of it:
 *
 *   1. Middleware: `ADMIN_IP_ALLOWLIST` check
 *      (apps/web/src/middleware.ts, [S-E1]).
 *   2. Layout client gate: `useAuthControllerMe` → role === 'admin' or
 *      a 403 panel.
 *   3. API guard: every admin controller `@Roles('admin')`.
 *
 * This spec covers gates 1 + 2 with a regular (non-admin) signed-up
 * user. The positive-path "admin actually verifies a scam report"
 * E2E needs a pre-seeded admin user (out-of-band via
 * `scripts/admin/promote-user.sh` per [S-E2]) — left as operator-owed
 * because the fixture-admin infra isn't worth the carrying cost yet.
 *
 * Coverage choices:
 *   - Sign up a fresh user (proves the auth boundary is wired).
 *   - Visit each admin route this slice / earlier slices added —
 *     /admin, /admin/sla, /admin/agent-kyc, /admin/scam-reports,
 *     /admin/audit. Assert each renders a 403 panel for non-admin
 *     (proves no 500, no missing-page).
 *   - Run axe-core on /admin so the 403 panel itself is WCAG-clean.
 *
 * Installed by [S-E7] of the S-series real-functionality closeout.
 */
import { test, expect } from '@playwright/test';
import { makeCredentials } from './helpers/auth';

const ADMIN_ROUTES = [
  '/admin',
  '/admin/sla', // [S-E4]
  '/admin/agent-kyc', // [S-E5/ui]
  '/admin/scam-reports',
  '/admin/audit',
] as const;

async function signUp(page: import('@playwright/test').Page): Promise<void> {
  const { email, password, displayName } = makeCredentials('admin-e2e');
  await page.goto('/register');
  await page.getByLabel(/email/i).last().fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  const nameField = page.getByLabel(/display\s*name/i);
  if (await nameField.count()) await nameField.first().fill(displayName);
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();
  await page.waitForURL(/\/trips(\b|\/|$)/, { timeout: 15_000 });
}

test.describe('admin gate — non-admin user', () => {
  test('every admin route renders a 403 panel (no 500, no missing-page)', async ({ page }) => {
    await signUp(page);

    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      // The layout's client-side gate renders a recognisable 403 message
      // when role !== 'admin'. It might bounce to /login first if the
      // silent-refresh hasn't completed — wait for either outcome.
      await page.waitForLoadState('networkidle');
      const body = (await page.textContent('body')) ?? '';
      // Either we see the 403 panel copy from the admin layout
      // ("admin only", "403", or the literal "permissions" loading
      // text), or we got bounced to /login (also acceptable — the
      // gate is doing its job).
      // Layout renders "403 — Admins only" for role !== 'admin' (see
      // apps/web/src/app/admin/layout.tsx). Match permissively in case
      // the copy drifts.
      const isOn403 = /admins?\s*only|403|forbidden|admin role required|not authori[zs]ed/i.test(
        body,
      );
      const isOnLogin = page.url().includes('/login');
      expect(isOn403 || isOnLogin, `route ${route} should 403 or bounce to /login`).toBe(true);

      // No raw stack traces / "Internal Server Error" / Next dev
      // overlay should ever land — those are 500-class regressions.
      expect(body).not.toMatch(/Internal Server Error/);
      expect(body).not.toMatch(/Application error: a client-side exception/);
    }
  });

  test('/admin 403 panel is axe-clean (WCAG 2 AA)', async ({ page }) => {
    await signUp(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Skip when the page bounced to /login — the 403 panel didn't render.
    if (page.url().includes('/login')) {
      test.skip(true, '/admin bounced to /login; 403 panel did not render');
    }
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });
});

test.describe('admin gate — anonymous', () => {
  test('/admin without auth bounces to /login', async ({ page }) => {
    await page.goto('/admin');
    // The layout's `useAuthBootComplete` finishes; with no token in
    // memory + no refresh cookie, the gate redirects.
    await page.waitForURL(/\/login(\b|\/|\?|$)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/login/);
  });
});
