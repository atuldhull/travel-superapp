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
import { getAccessToken, subscribeToAuthToken } from './auth-store';

const noopSnapshot = (): null => null;

export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribeToAuthToken, getAccessToken, noopSnapshot);
}
