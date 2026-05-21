/**
 * Phase 5 (J4) — read the `sub` (user id) claim out of the in-memory
 * access token.
 *
 * The app keeps the access token in memory (never localStorage — the
 * token-storage rule) and there was no helper to read the current
 * user's id from it. Components that need "is this mine?" (e.g. the
 * comment thread's delete button) decode it here.
 *
 * This is a DISPLAY-ONLY convenience — it does NOT verify the
 * signature. Every real authorisation decision is made server-side
 * against the verified token; a spoofed `sub` here would only ever
 * show a delete button that the API then rejects with a 404.
 */

interface JwtPayload {
  readonly sub?: unknown;
}

/** Base64url-decode the JWT payload and return its `sub`, or null. */
export function decodeJwtSub(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1] ?? '';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
    const parsed = JSON.parse(json) as JwtPayload;
    return typeof parsed.sub === 'string' && parsed.sub.length > 0 ? parsed.sub : null;
  } catch {
    return null;
  }
}
