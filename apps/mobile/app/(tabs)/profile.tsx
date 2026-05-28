/**
 * V.UX.27 — Profile tab. Shows the caller's identity (sub, role,
 * displayName) + a sign-out button that clears the persisted access
 * token and the React-Query cache.
 *
 * Anonymous viewers are redirected to /login (the deep-link target
 * for any auth-gated tab).
 *
 * Installed by prompt [V.UX.27].
 */
import { Redirect, router } from 'expo-router';
import { Button, Card, Text, XStack, YStack } from 'tamagui';
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
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
      <Text fontSize={18} fontWeight="700">
        Profile
      </Text>
      {body ? (
        <YStack gap="$2">
          <Text>
            Role: <Text fontWeight="600">{body.role}</Text>
          </Text>
          <Text fontSize={12} color="$color10">
            User id: {body.sub}
          </Text>
        </YStack>
      ) : (
        <Text color="$color10">Loading…</Text>
      )}

      {/* [S-D4] Push notifications opt-in. Permission ask is gated
          behind this button so we don't nag on app launch. */}
      <Card padding="$3" bordered>
        <YStack gap="$2">
          <Text fontSize={14} fontWeight="600">
            Notifications
          </Text>
          {push.permission === 'granted' ? (
            <YStack gap="$1">
              <Text color="$green10" fontSize={12}>
                ✓ Enabled
              </Text>
              {push.token ? (
                <Text fontSize={10} color="$color10" fontFamily="$mono">
                  {push.token.slice(0, 32)}…
                </Text>
              ) : null}
              <Text fontSize={10} color="$color10">
                Backend register-token endpoint is queued; tokens land in your account once it
                ships.
              </Text>
            </YStack>
          ) : push.permission === 'denied' ? (
            <Text color="$orange10" fontSize={12}>
              Denied — enable in iOS / Android Settings → Notifications.
            </Text>
          ) : (
            <XStack gap="$2" alignItems="center">
              <Button size="$2" onPress={() => void push.enable()}>
                Enable notifications
              </Button>
              <Text fontSize={11} color="$color10">
                Trip updates, SOS alerts, agent replies.
              </Text>
            </XStack>
          )}
        </YStack>
      </Card>

      <Button onPress={handleSignOut}>Sign out</Button>
    </YStack>
  );
}
