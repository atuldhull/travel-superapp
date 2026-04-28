/**
 * V.UX.15 — React hook over the comfort-mode store. Same shape as
 * `useAuthToken` (useSyncExternalStore against a vanilla pub/sub).
 *
 * Installed by prompt [V.UX.15].
 */
'use client';

import { useSyncExternalStore } from 'react';
import { getComfortMode, subscribeToComfortMode } from './comfort-mode';

const falseSnapshot = (): boolean => false;

export function useComfortMode(): boolean {
  return useSyncExternalStore(subscribeToComfortMode, getComfortMode, falseSnapshot);
}
