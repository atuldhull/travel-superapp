/**
 * Phase 4 / Round AS (AE519) - Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 - Profile tab. Shows the caller's identity (sub, role,
 * displayName) + a sign-out button that clears the persisted access
 * token and the React-Query cache.
 *
 * Anonymous viewers are redirected to /login (the deep-link target
 * for any auth-gated tab).
 */
import { Redirect, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { setAccessToken } from '../../lib/sdk';
import { usePushNotifications } from '../../lib/use-push-notifications';

export default function ProfileScreen() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const push = usePushNotifications();
  const me = useAuthControllerMe({
    query: { enabled: token !== null, retry: false },
  });

  if (token === null) return <Redirect href="/login" />;

  const body = me.data?.data as WhoAmIResponseDto | undefined;

  async function handleSignOut() {
    await setAccessToken(null);
    queryClient.clear();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {body ? (
        <View style={styles.colGap2}>
          <Text style={styles.body}>
            Role: <Text style={styles.semibold}>{body.role}</Text>
          </Text>
          <Text style={styles.muted}>User id: {body.sub}</Text>
        </View>
      ) : (
        <Text style={styles.mutedBody}>Loading...</Text>
      )}

      {/* [S-D4] Push notifications opt-in. Permission ask is gated
          behind this button so we don't nag on app launch. */}
      <View style={styles.card}>
        <View style={styles.colGap2}>
          <Text style={styles.cardTitle}>Notifications</Text>
          {push.permission === 'granted' ? (
            <View style={styles.colGap1}>
              <Text style={styles.successSmall}>Enabled</Text>
              {push.token ? <Text style={styles.mono}>{push.token.slice(0, 32)}...</Text> : null}
              <Text style={styles.tinyMuted}>
                Backend register-token endpoint is queued; tokens land in your account once it
                ships.
              </Text>
            </View>
          ) : push.permission === 'denied' ? (
            <Text style={styles.warnSmall}>
              Denied - enable in iOS / Android Settings, Notifications.
            </Text>
          ) : (
            <View style={styles.rowCenterGap2}>
              <TouchableOpacity style={styles.smallButton} onPress={() => void push.enable()}>
                <Text style={styles.smallButtonText}>Enable notifications</Text>
              </TouchableOpacity>
              <Text style={styles.tinyMuted}>Trip updates, SOS alerts, agent replies.</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'column',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    fontSize: 14,
    color: '#111',
  },
  semibold: {
    fontWeight: '600',
  },
  muted: {
    fontSize: 12,
    color: '#666',
  },
  mutedBody: {
    fontSize: 14,
    color: '#666',
  },
  colGap1: {
    flexDirection: 'column',
    gap: 4,
  },
  colGap2: {
    flexDirection: 'column',
    gap: 8,
  },
  rowCenterGap2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  successSmall: {
    fontSize: 12,
    color: '#0a7a3b',
  },
  warnSmall: {
    fontSize: 12,
    color: '#b45309',
  },
  tinyMuted: {
    fontSize: 11,
    color: '#666',
  },
  mono: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'Courier',
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#111',
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
