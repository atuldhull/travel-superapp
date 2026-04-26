/**
 * React hook over the memory-only auth-token store. Components that
 * need to react to login/logout subscribe via this; the store itself
 * stays framework-agnostic so server-side code can call it too.
 *
 * `useSyncExternalStore` is the React 18+ contract for external mutable
 * state — handles tearing in concurrent rendering correctly without us
 * hand-rolling effect-based subscriptions.
 *
 * Installed by prompt [IV.18.19.21].
 */
'use client';

import { useSyncExternalStore } from 'react';
import { getAccessToken, getBootComplete, subscribeToAuthToken } from './auth-store';

const nullSnapshot = (): null => null;
const trueSnapshot = (): boolean => true;

export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribeToAuthToken, getAccessToken, nullSnapshot);
}

/**
 * `true` once `SilentRefreshOnMount` has completed its first attempt
 * (success OR failure). Protected pages should hold their "no token →
 * /login" redirect until this flips, otherwise a hard reload bounces
 * before silent-refresh has a chance to resurrect the session.
 *
 * SSR: server returns `true` so prerendered output doesn't show a
 * loading spinner; hydration on the client overrides with the real
 * boot state on the first commit.
 */
export function useAuthBootComplete(): boolean {
  return useSyncExternalStore(subscribeToAuthToken, getBootComplete, trueSnapshot);
}
