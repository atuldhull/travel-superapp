/**
 * I2 (Phase 6) — `useOnline()` hook. A tiny SSR-safe wrapper around
 * `navigator.onLine` + the browser's `online` / `offline` events.
 *
 * `navigator.onLine` is best-effort by design — the browser knows
 * the OS network stack is up, not whether any specific API is
 * reachable. Pages that need REAL reachability still rely on the
 * fetch promise rejecting; the hook just gives us a soft signal so
 * we can flip the UI between "live" and "offline copy" tones.
 *
 * Returns `true` during SSR and on the first hydration tick to avoid
 * a flash-of-offline; the actual value lands on `useEffect`.
 *
 * Installed by [Phase-6/I2].
 */
'use client';

import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  // Default to online so SSR renders the live path. Browsers without
  // `navigator.onLine` (rare) will stay on this default.
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () =>
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
