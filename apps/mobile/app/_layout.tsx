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

export default function RootLayout() {
  const [ready, setReady] = useState(false);
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
          </Stack>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
