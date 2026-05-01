/**
 * V.UX.27 — wires `@app/sdk` for the Expo runtime. Two responsibilities:
 *
 *   1. `configureSdk` once per app boot — base URL from app.json's
 *      `extra.apiBaseUrl` (or fallback to localhost which the dev
 *      tunnel + LAN ip dance makes Just Work for Expo Go).
 *   2. Expose a tiny in-memory access-token store + AsyncStorage-backed
 *      bootstrap. The token is hydrated from disk on app start; the
 *      `setAccessToken` setter writes both memory + disk.
 *
 * CLAUDE.md rule 12 forbids `localStorage` for tokens on web. RN has
 * no `localStorage`; the equivalent guidance is "encrypt at rest".
 * We use AsyncStorage (unencrypted by default) for now — swap to
 * `expo-secure-store` when the tokens leave dev.
 *
 * Installed by prompt [V.UX.27].
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { configureSdk } from '@app/sdk';

const TOKEN_KEY = 'travel-mobile-access-token';

let memoryToken: string | null = null;
const subscribers = new Set<(t: string | null) => void>();

function notify(): void {
  for (const fn of subscribers) fn(memoryToken);
}

export function getAccessToken(): string | null {
  return memoryToken;
}

export async function setAccessToken(token: string | null): Promise<void> {
  memoryToken = token;
  if (token === null) {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
  notify();
}

export function subscribeAccessToken(fn: (t: string | null) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Idempotent boot. Call from the root layout effect on app start. */
export async function bootSdk(): Promise<void> {
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };
  // `process.env` is exposed in the Expo runtime via babel-preset-expo's
  // EXPO_PUBLIC_* substitution; cast through globalThis to avoid pulling
  // @types/node into a React Native package.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const baseUrl = extra.apiBaseUrl ?? env?.['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000';
  configureSdk({
    baseUrl,
    getAccessToken: () => memoryToken,
  });
  if (memoryToken === null) {
    const stored = await AsyncStorage.getItem(TOKEN_KEY);
    if (stored !== null && stored.length > 0) {
      memoryToken = stored;
      notify();
    }
  }
}
