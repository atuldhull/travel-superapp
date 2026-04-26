/**
 * Silent-refresh on mount + on a schedule. Calls `POST /auth/refresh`
 * which (cross-origin via `credentials: 'include'` in apiFetch) sends
 * the httpOnly refresh cookie set during the prior login. On success,
 * the new access token lands in the in-memory `auth-store` so any
 * subsequent SDK call picks it up.
 *
 * Run-on-mount handles the hard-reload case: a page refresh kills the
 * in-memory token, but the refresh cookie survives. The hook
 * resurrects the session before any protected page render reaches its
 * `useAuthToken()` redirect check.
 *
 * Run-on-schedule (every 10m) keeps long-lived tabs warm: access
 * tokens have a 15m TTL (Playbook §13.2), so re-rolling at 10m
 * intervals leaves a 5m safety buffer.
 *
 * On failure (no cookie, expired refresh, REFRESH_REUSED) the hook
 * silently no-ops — the user stays logged out and existing redirect
 * logic in protected pages handles the bounce.
 *
 * Installed by prompt [IV.18.19.24].
 */
'use client';

import { useEffect, useRef } from 'react';
import { authControllerRefresh, type RefreshSuccessResponseDto } from '@app/sdk';
import { markBootComplete, setAccessToken } from './auth-store';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SilentRefreshOnMount(): null {
  const ranOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function attempt(isBoot: boolean): Promise<void> {
      try {
        const res = (await authControllerRefresh()) as unknown as RefreshSuccessResponseDto;
        if (cancelled) return;
        if (res?.accessToken) setAccessToken(res.accessToken);
      } catch {
        // Quietly ignore — the most common failure is "no refresh
        // cookie present", which is exactly the not-yet-signed-in
        // case. Any logged route will still bounce to /login.
      } finally {
        // Always mark boot complete after the first attempt — protected
        // pages waiting on `useAuthBootComplete()` need to unblock even
        // when refresh fails (otherwise they spin forever).
        if (isBoot) markBootComplete();
      }
    }

    if (!ranOnce.current) {
      ranOnce.current = true;
      void attempt(true);
    }

    const id = setInterval(() => {
      void attempt(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
