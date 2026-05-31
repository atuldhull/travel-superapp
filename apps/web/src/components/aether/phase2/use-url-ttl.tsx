'use client';

/**
 * AE405 — `useUrlTtlRefetch(expiresAt, refetch)` hook.
 *
 * Schedules a single `setTimeout` to call the supplied refetch fn
 * exactly `refetchDelayMs(expiresAt)` ms from now. Clears the timer on
 * unmount or when `expiresAt`/`refetch` change so we never leak a fire
 * that targets a stale closure.
 */
import { useEffect } from 'react';
import { refetchDelayMs } from './url-ttl';

export function useUrlTtlRefetch(expiresAt: string | null | undefined, refetch: () => void): void {
  useEffect(() => {
    const delay = refetchDelayMs(expiresAt);
    if (delay === null) return undefined;
    const id = window.setTimeout(() => refetch(), delay);
    return (): void => {
      window.clearTimeout(id);
    };
  }, [expiresAt, refetch]);
}
