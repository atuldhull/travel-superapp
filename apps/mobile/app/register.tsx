/**
 * V.UX.27 (sub-prompt 2) — register screen. Same `/auth/register`
 * endpoint the web app uses. On success, the api returns the access
 * token directly; we stash it via the in-memory store + AsyncStorage
 * and bounce to the Trips tab.
 *
 * Validation mirrors the api Zod schema: email ≤254, password 12..128,
 * displayName 1..60.
 *
 * Installed by prompt [V.UX.27].
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input, Text, YStack } from 'tamagui';
import { useAuthControllerRegister, type AuthSuccessResponseDto } from '@app/sdk';
import { setAccessToken } from '../lib/sdk';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const register = useAuthControllerRegister();

  async function handleSubmit() {
    if (password.length < 12) {
      Alert.alert('Password too short', 'Use at least 12 characters.');
      return;
    }
    try {
      const res = await register.mutateAsync({
        data: { email, password, displayName },
      });
      const body = res.data as unknown as AuthSuccessResponseDto;
      await setAccessToken(body.accessToken);
      router.replace('/(tabs)/trips');
    } catch (err) {
      const e = err as ApiError;
      Alert.alert('Sign-up failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message}`);
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3" justifyContent="center">
      <Text fontSize={22} fontWeight="700">
        Create account
      </Text>
      <Input
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        placeholder="password (min 12 chars)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Input placeholder="display name" value={displayName} onChangeText={setDisplayName} />
      <Button onPress={handleSubmit} disabled={register.isPending}>
        {register.isPending ? 'Creating…' : 'Create account'}
      </Button>
      <Link href="/login" asChild>
        <Text fontSize={12} color="$blue10" textAlign="center">
          Already have an account? Sign in
        </Text>
      </Link>
      <Link href="/auth/magic-link" asChild>
        <Text fontSize={12} color="$blue10" textAlign="center">
          Sign in with a magic link instead
        </Text>
      </Link>
    </YStack>
  );
}
