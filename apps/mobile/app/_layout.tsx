/**
 * V.UX.27 â€” Expo Router root layout. Boots the SDK, mounts the
 * persisted React-Query client, and exposes a top-level Stack so the
 * (tabs) group + the modal-style detail screens nest cleanly.
 *
 * Phase 4 / Round AS (AE518) â€” Tamagui stripped; uses plain RN
 * primitives. Will be retired entirely when the Aether mobile surface
 * ships.
 *
 * Deep-link surface: every web URL pattern under `/trips/[id]`,
 * `/memory-books/[id]`, and the tab screens maps directly to the
 * file-based router via the `scheme: travelapp` + the
 * `associatedDomains` declared in app.json.
 *
 * Installed by prompt [V.UX.27].
 */
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { bootSdk } from '../lib/sdk';
import { persistOptions, queryClient } from '../lib/offline-cache';
import { usePushNotifications } from '../lib/use-push-notifications';
import { AetherPulseGlow } from '../src/aether/pulse-glow';
import { useReducedMotionNative } from '../lib/use-reduced-motion-native';

/** Phase 4 feature flag (mirror of web NEXT_PUBLIC_FEATURE_AETHER_PHASE1).
 *  Gates the always-present Pulse overlay so it never renders on the 1.0
 *  routes in production (flag unset) — AE573. */
const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // AE532 - OS Reduce Motion feed for every Aether mobile surface.
  // Threaded into <AetherPulseGlow/> so its breathing loop collapses to
  // a static envelope when the user has Reduce Motion enabled.
  const reducedMotion = useReducedMotionNative();
  // [S-D4] Wire the notification-tap deep-link handler at root so it
  // catches notifications regardless of which surface the user lands
  // on. Permission ask + Expo-token fetch are NOT auto-triggered â€”
  // profile.tsx surfaces a CTA the user has to opt into.
  usePushNotifications();

  useEffect(() => {
    let mounted = true;
    void bootSdk().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#ffffff' },
              headerTintColor: '#0a0a0a',
              headerTitleStyle: { fontWeight: '600' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Sign in' }} />
            <Stack.Screen name="register" options={{ title: 'Create account' }} />
            <Stack.Screen name="auth/magic-link" options={{ title: 'Magic link' }} />
            <Stack.Screen
              name="auth/magic-link/[token]"
              options={{ title: 'Signing in', headerBackVisible: false }}
            />
            <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
            <Stack.Screen name="memory-books/[id]" options={{ title: 'Memory book' }} />
            {/* Aether mobile surface routes (AE537 onward) — all 9 non-overlay surfaces. */}
            <Stack.Screen name="aether/drift" options={{ title: 'Drift' }} />
            <Stack.Screen name="aether/atlas" options={{ title: 'Atlas' }} />
            <Stack.Screen name="aether/continuum" options={{ title: 'Continuum' }} />
            <Stack.Screen name="aether/compass" options={{ title: 'Compass' }} />
            <Stack.Screen name="aether/vault" options={{ title: 'Vault' }} />
            <Stack.Screen name="aether/lumen" options={{ title: 'Lumen' }} />
            <Stack.Screen name="aether/echo" options={{ title: 'Echo' }} />
            <Stack.Screen name="aether/genie" options={{ title: 'Genie' }} />
            <Stack.Screen name="aether/mirror" options={{ title: 'Mirror' }} />
          </Stack>
          {/* AE527 — Aether Pulse glow rendered above the Stack so it
              persists across navigation. pointerEvents='none' inside the
              component keeps it from blocking taps. Flag-gated (AE573) so
              it never renders on the 1.0 routes in production. */}
          {AETHER_ENABLED ? <AetherPulseGlow reducedMotion={reducedMotion} /> : null}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
