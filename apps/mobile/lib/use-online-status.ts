/**
 * V.UX.27 (sub-prompt 2) — connectivity hook backed by
 * `@react-native-community/netinfo` on native, falling back to the
 * browser `navigator.onLine` event on the Expo `--web` target.
 *
 * Returns `true` when the device has an active connection AND the OS
 * confirms it can reach the internet (`isInternetReachable`). A
 * captive-portal WiFi where we're "connected" but can't reach the api
 * still surfaces the offline banner.
 *
 * Sub-prompt 1 used a bare `navigator.onLine` polyfill — that only
 * worked on web. NetInfo gives the same hook a real RN signal.
 *
 * Installed by prompt [V.UX.27].
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        setOnline(navigator.onLine);
      }
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
          window.removeEventListener('online', on);
          window.removeEventListener('offline', off);
        };
      }
      return;
    }
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      const connected = state.isConnected ?? false;
      setOnline(reachable === null ? connected : connected && reachable);
    });
    return unsubscribe;
  }, []);

  return online;
}
