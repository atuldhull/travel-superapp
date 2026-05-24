/**
 * User factories ([I1]). Wraps `POST /api/v1/auth/register` +
 * cookie extraction in one call so tests don't re-implement the
 * 15-line "register + parse refresh cookie" dance every file.
 *
 * Installed by prompt [I1].
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { TEST_PASSWORD, uniqueEmail, uniqueName } from './index';

export interface RegisteredUser {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly accessToken: string;
  /** `name=value` slice of the `Set-Cookie: refresh_token=…` header,
   *  ready to be sent back as `cookie:` on the next request. */
  readonly refreshCookie: string;
}

export interface RegisterUserOptions {
  /** Stable prefix per test suite (e.g. `'account-delete-e2e'`) so
   *  the per-suite cleanup `where: startsWith(prefix)` still works. */
  readonly prefix: string;
  /** Optional human-readable suffix; defaults to a random one. */
  readonly hint?: string;
}

/** Hit `POST /api/v1/auth/register` with a freshly-minted unique email
 *  + canonical test password, then parse the response into a typed
 *  RegisteredUser. Replaces the hand-rolled `${TEST_PREFIX}-${suffix}-
 *  ${Date.now()}@example.com` pattern across 129 test files.
 *
 *  ASSUMES the HTTP path + cookie shape match the current AuthModule
 *  contract — if either changes, this factory is the ONE place to
 *  update, not every test file. */
export async function registerUser(
  app: NestFastifyApplication,
  opts: RegisterUserOptions,
): Promise<RegisteredUser> {
  const displayName = opts.hint ? `${opts.prefix}-${opts.hint}` : uniqueName(opts.prefix);
  const email = uniqueEmail(opts.prefix);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: TEST_PASSWORD, displayName },
  });
  if (res.statusCode !== 201) {
    throw new Error(
      `registerUser: expected 201, got ${res.statusCode}. ` + `Body: ${res.body.slice(0, 200)}`,
    );
  }
  const body = JSON.parse(res.body) as { userId: string; accessToken: string };
  const refreshCookie = extractRefreshCookie(res.headers['set-cookie']);
  return {
    userId: body.userId,
    accessToken: body.accessToken,
    email,
    password: TEST_PASSWORD,
    displayName,
    refreshCookie,
  };
}

/** Pulls the `refresh_token=…` cookie out of a Set-Cookie response
 *  header (single string OR array depending on Fastify's quirks),
 *  stripping attributes (`Path=/; HttpOnly; …`) so the caller can
 *  pass it back as `cookie:`. */
export function extractRefreshCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const refresh = cookies.find((c) => c.startsWith('refresh_token='));
  if (!refresh) {
    throw new Error('registerUser: no refresh_token Set-Cookie header in response');
  }
  return refresh.split(';')[0]!;
}
