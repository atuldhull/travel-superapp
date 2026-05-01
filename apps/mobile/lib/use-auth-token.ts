/**
 * V.UX.27 — React hook mirror of the in-memory token store from
 * `lib/sdk.ts`. Subscribes to set/clear so any screen that gates on
 * auth re-renders when the user logs in / out.
 *
 * Installed by prompt [V.UX.27].
 */
import { useEffect, useState } from 'react';
import { getAccessToken, subscribeAccessToken } from './sdk';

export function useAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(getAccessToken());
  useEffect(() => subscribeAccessToken(setToken), []);
  return token;
}
