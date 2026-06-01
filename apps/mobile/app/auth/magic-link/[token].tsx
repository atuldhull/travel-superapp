/**
 * Phase 4 / Round AS (AE520) - Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 (sub-prompt 2) - magic-link consume. Triggered by
 * `travelapp://auth/magic-link/<token>` (or the universal-link
 * https variant). Posts the token to `/auth/magic-link/consume`,
 * stashes the returned access token, redirects to Trips on success.
 *
 * Failure path bounces back to /login with an Alert so the user
 * isn't stranded on a dead intent.
 *
 * Installed by prompt [V.UX.27].
 */
import { useEffect } from 'react';
import { Alert, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthControllerMagicLinkConsume, type AuthSuccessResponseDto } from '@app/sdk';
import { setAccessToken } from '../../../lib/sdk';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function MagicLinkConsumeScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const consume = useAuthControllerMagicLinkConsume();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await consume.mutateAsync({ data: { token } });
        if (cancelled) return;
        const body = res.data as unknown as AuthSuccessResponseDto;
        await setAccessToken(body.accessToken);
        router.replace('/(tabs)/trips');
      } catch (err) {
        if (cancelled) return;
        const e = err as ApiError;
        Alert.alert('Magic link failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} - ${e.message}`);
        router.replace('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.label}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
});
