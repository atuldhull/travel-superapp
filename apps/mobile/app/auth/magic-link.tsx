/**
 * V.UX.27 (sub-prompt 2) — magic-link request screen. Posts the
 * caller's email to `/auth/magic-link/request`; the api emails a
 * `travelapp://auth/magic-link/<token>` deep link that, when tapped,
 * launches the consume route below + signs the user in.
 *
 * Mirrors the web's V.UX.2 surface.
 *
 * Installed by prompt [V.UX.27].
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { Link } from 'expo-router';
import { Button, Input, Text, YStack } from 'tamagui';
import { useAuthControllerMagicLinkRequest } from '@app/sdk';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function MagicLinkRequestScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const request = useAuthControllerMagicLinkRequest();

  async function handleSubmit() {
    try {
      await request.mutateAsync({ data: { email } });
      setSent(true);
    } catch (err) {
      const e = err as ApiError;
      Alert.alert('Send failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message}`);
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3" justifyContent="center">
      <Text fontSize={22} fontWeight="700">
        Sign in with magic link
      </Text>
      {sent ? (
        <YStack gap="$2">
          <Text>Check your inbox for a sign-in link.</Text>
          <Text fontSize={12} color="$color10">
            Tap the link in the email to land back here signed in.
          </Text>
        </YStack>
      ) : (
        <>
          <Input
            placeholder="email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button onPress={handleSubmit} disabled={request.isPending}>
            {request.isPending ? 'Sending…' : 'Send magic link'}
          </Button>
        </>
      )}
      <Link href="/login" asChild>
        <Text fontSize={12} color="$blue10" textAlign="center">
          Back to password sign-in
        </Text>
      </Link>
    </YStack>
  );
}
