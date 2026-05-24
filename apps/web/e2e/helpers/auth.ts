/**
 * Authenticated-E2E helpers ([J5]).
 *
 * Same factory posture as `apps/api/test/factories/` — generate
 * unique-per-run credentials so parallel Playwright workers don't
 * collide on the same email.
 *
 * The HTTP-direct path (`registerViaApi`) is useful for tests that
 * need to be logged in but aren't testing the signup UI itself —
 * skip the form keystrokes, get a session in <100ms.
 *
 * The UI path is what the `auth-flow.spec.ts` test exercises — it
 * proves the signup form actually wires through to a working
 * session.
 */
import { randomUUID } from 'node:crypto';

export const TEST_DOMAIN = 'example.com';
export const TEST_PASSWORD = 'correct-horse-battery-staple';

export interface E2ECredentials {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

/** Fresh per-test credentials. Same crypto.randomUUID approach the
 *  api factories use; same collision-free posture across parallel
 *  workers. */
export function makeCredentials(prefix = 'e2e'): E2ECredentials {
  const slug = randomUUID().replace(/-/g, '').slice(0, 8);
  return {
    email: `${prefix}-${slug}@${TEST_DOMAIN}`,
    password: TEST_PASSWORD,
    displayName: `${prefix}-${slug}`,
  };
}

/** Hit `POST /api/v1/auth/register` directly. Returns
 *  `{ accessToken, refreshCookie }` — the test can drop those into
 *  the browser context as needed. */
export async function registerViaApi(
  apiBase: string,
  creds: E2ECredentials,
): Promise<{ readonly accessToken: string; readonly refreshCookie: string | undefined }> {
  const res = await fetch(`${apiBase}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: creds.email,
      password: creds.password,
      displayName: creds.displayName,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`registerViaApi: ${res.status} — ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { accessToken: string };
  // Set-Cookie may not be reachable from fetch in node without
  // explicit credentials handling; surface what we have.
  return {
    accessToken: json.accessToken,
    refreshCookie: res.headers.get('set-cookie') ?? undefined,
  };
}
