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
import { Button, Text, YStack } from 'tamagui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { setAccessToken } from '../../lib/sdk';

export default function ProfileScreen() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
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
      <Button onPress={handleSignOut}>Sign out</Button>
    </YStack>
  );
}
