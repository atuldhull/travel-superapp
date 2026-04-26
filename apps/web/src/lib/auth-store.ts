/**
 * In-memory access-token store + small pub/sub for token changes.
 *
 * - Tokens NEVER touch localStorage / sessionStorage / cookies on
 *   the client side — CLAUDE rule 12. The refresh cookie lives on
 *   the api domain only (httpOnly, sameSite=strict). On a fresh
 *   tab/load the user is "logged out" until they sign in again or
 *   we wire silent-refresh in a follow-up slice.
 * - Subscribers are notified whenever the token changes so React
 *   surfaces (`useAuthToken`) re-render with the new auth state.
 *
 * Installed by prompt [IV.18.19.21].
 */

let token: string | null = null;
let bootComplete = false;
const subscribers = new Set<() => void>();

export function getAccessToken(): string | null {
  return token;
}

export function setAccessToken(next: string | null): void {
  if (token === next) return;
  token = next;
  notify();
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

/**
 * `bootComplete` flips to `true` once silent-refresh-on-mount has
 * finished its first attempt (success OR failure). Protected pages
 * use this to delay the "no token → redirect" decision until the
 * httpOnly refresh cookie has had its chance to resurrect the
 * session — otherwise a hard reload always bounces to /login.
 */
export function getBootComplete(): boolean {
  return bootComplete;
}

export function markBootComplete(): void {
  if (bootComplete) return;
  bootComplete = true;
  notify();
}

function notify(): void {
  for (const sub of subscribers) sub();
}

/**
 * Internal pub/sub used by `useAuthToken` + `useAuthBootComplete`.
 * Stable reference so React's `useSyncExternalStore` doesn't
 * re-subscribe on every render.
 */
export function subscribeToAuthToken(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
