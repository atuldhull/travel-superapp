/**
 * V.UX.27 — sign-in screen. Same `/auth/login` endpoint the web app
 * uses; on success we stash the access token via the in-memory store
 * (also persisted to AsyncStorage so the next launch is signed in)
 * and bounce back to the Trips tab.
 *
 * Magic-link / OAuth / register flows land in sub-prompt 2; this
 * slice ships the password path so the demo loop works end-to-end.
 *
 * Installed by prompt [V.UX.27].
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input, Text, YStack } from 'tamagui';
import { useAuthControllerLogin, type AuthSuccessResponseDto } from '@app/sdk';
import { setAccessToken } from '../lib/sdk';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthControllerLogin();

  async function handleSubmit() {
    try {
      const res = await login.mutateAsync({ data: { email, password } });
      const body = res.data as unknown as AuthSuccessResponseDto;
      await setAccessToken(body.accessToken);
      router.replace('/(tabs)/trips');
    } catch (err) {
      const e = err as ApiError;
      Alert.alert('Sign-in failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message}`);
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3" justifyContent="center">
      <Text fontSize={22} fontWeight="700">
        Sign in
      </Text>
      <Input
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input placeholder="password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button onPress={handleSubmit} disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <Link href="/register" asChild>
        <Text fontSize={12} color="$blue10" textAlign="center">
          New here? Create an account
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
