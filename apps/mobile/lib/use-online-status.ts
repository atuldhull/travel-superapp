/**
 * V.UX.27 — minimal online/offline detection. Uses the browser-style
 * `navigator.onLine` API which `react-native-web` polyfills + which
 * `expo-network` writes through on native (the runtime is stubbed
 * to true at boot — the offline banner will only flip after the
 * first failed query, which is acceptable for a v1 shell).
 *
 * Future: replace with `@react-native-community/netinfo` when we
 * want truly active connectivity monitoring + signal-quality data
 * for the "poor signal" banner mentioned in the persona spec.
 *
 * Installed by prompt [V.UX.27].
 */
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
