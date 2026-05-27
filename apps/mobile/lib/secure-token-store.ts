/**
 * Encrypted token store for the Expo runtime.
 *
 * [S-D1] swaps the V.UX.27 AsyncStorage-backed token store for one
 * that uses `expo-secure-store` on native (iOS Keychain + Android
 * EncryptedSharedPreferences) and falls back to AsyncStorage on
 * Expo Web (where SecureStore is unavailable; documented Expo
 * limitation).
 *
 * Migration on first boot: if a token is already in the legacy
 * AsyncStorage key (V.UX.27 users), copy it into SecureStore once
 * + delete the legacy entry. The migration is idempotent + best-
 * effort; if SecureStore fails (e.g. user disabled the device
 * passcode after install), we fall through to AsyncStorage and
 * log a warning.
 *
 * Closes the Z1 mobile-audit ship-blocker: "auth (security) 30%
 * — access token in memory ✓; persistence in UNENCRYPTED
 * AsyncStorage ✗."
 *
 * Installed by [S-D1] of the S-series real-functionality closeout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage key. Distinct namespace from the V.UX.27 AsyncStorage key
 * so the one-time migration is a clear data-flow ("read legacy →
 * write secure → delete legacy").
 */
const SECURE_KEY = 'travel-mobile-access-token-secure';
const LEGACY_KEY = 'travel-mobile-access-token';

/**
 * SecureStore availability check. iOS / Android = always available.
 * Expo Web = always unavailable (returns false at runtime + throws on
 * any call). Use Platform check at module load + cache.
 *
 * `SecureStore.isAvailableAsync` is the Expo-recommended runtime
 * check, but on web it throws synchronously on import in some Expo
 * SDK versions. The Platform guard avoids that risk entirely.
 */
const SECURE_STORE_AVAILABLE = Platform.OS === 'ios' || Platform.OS === 'android';

/** Get the persisted access token, migrating once from the legacy key. */
export async function readPersistedToken(): Promise<string | null> {
  if (!SECURE_STORE_AVAILABLE) {
    return AsyncStorage.getItem(LEGACY_KEY);
  }

  // Try SecureStore first — the steady-state path.
  try {
    const fromSecure = await SecureStore.getItemAsync(SECURE_KEY);
    if (fromSecure !== null && fromSecure.length > 0) {
      return fromSecure;
    }
  } catch (err) {
    // SecureStore can fail on devices without a passcode lock screen.
    // Log + fall through to legacy AsyncStorage so the user isn't
    // unceremoniously logged out.
    // eslint-disable-next-line no-console -- bootstrap before logger
    console.warn('[secure-token-store] SecureStore.getItemAsync failed; falling back', err);
  }

  // Migration window: legacy AsyncStorage key from V.UX.27. Read once,
  // copy into SecureStore (best-effort), delete the legacy entry.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy === null || legacy.length === 0) return null;
  try {
    await SecureStore.setItemAsync(SECURE_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch (err) {
    // eslint-disable-next-line no-console -- bootstrap before logger
    console.warn('[secure-token-store] migrate-on-read failed; legacy retained', err);
  }
  return legacy;
}

/** Persist or clear the access token. Best-effort migration of legacy on every write. */
export async function writePersistedToken(token: string | null): Promise<void> {
  if (!SECURE_STORE_AVAILABLE) {
    if (token === null) {
      await AsyncStorage.removeItem(LEGACY_KEY);
    } else {
      await AsyncStorage.setItem(LEGACY_KEY, token);
    }
    return;
  }

  if (token === null) {
    // Clear both — defensive in case the legacy migration on read
    // hadn't happened yet (e.g. user signed out before any read).
    await Promise.allSettled([
      SecureStore.deleteItemAsync(SECURE_KEY),
      AsyncStorage.removeItem(LEGACY_KEY),
    ]);
    return;
  }

  try {
    await SecureStore.setItemAsync(SECURE_KEY, token);
  } catch (err) {
    // SecureStore unavailable at runtime (no device passcode) — fall back
    // so the user can still sign in. Worse than encrypted, better than
    // a hard sign-in failure.
    // eslint-disable-next-line no-console -- bootstrap before logger
    console.warn('[secure-token-store] SecureStore.setItemAsync failed; using AsyncStorage', err);
    await AsyncStorage.setItem(LEGACY_KEY, token);
    return;
  }
  // Successful secure write — also clear any leftover legacy entry.
  await AsyncStorage.removeItem(LEGACY_KEY);
}
