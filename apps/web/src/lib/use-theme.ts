/**
 * React hook over the theme store. `useSyncExternalStore` so the
 * theme toggle in the header re-renders correctly when the
 * preference changes from another tab (storage event handling lands
 * in a follow-up if cross-tab sync becomes important).
 *
 * SSR snapshot returns "system" so prerendered output doesn't flash
 * a wrong choice; client hydration overrides on first commit.
 *
 * Installed by prompt [IV.18.19.28].
 */
'use client';

import { useSyncExternalStore } from 'react';
import { getThemePreference, subscribeToTheme, type ThemePreference } from './theme-store';

const systemSnapshot = (): ThemePreference => 'system';

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeToTheme, getThemePreference, systemSnapshot);
}
