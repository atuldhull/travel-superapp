/**
 * Phase 4 / Round AS (AE520) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 (sub-prompt 2) â€” register screen. Same `/auth/register`
 * endpoint the web app uses. On success, the api returns the access
 * token directly; we stash it via the in-memory store + AsyncStorage
 * and bounce to the Trips tab.
 *
 * Validation mirrors the api Zod schema: email <=254, password 12..128,
 * displayName 1..60.
 *
 * Installed by prompt [V.UX.27].
 */
import { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
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
      Alert.alert('Sign-up failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} - ${e.message}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="password (min 12 chars)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="display name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TouchableOpacity
        style={[styles.button, register.isPending && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={register.isPending}
      >
        <Text style={styles.buttonText}>
          {register.isPending ? 'Creating...' : 'Create account'}
        </Text>
      </TouchableOpacity>
      <Link href="/login" asChild>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Link>
      <Link href="/auth/magic-link" asChild>
        <Text style={styles.link}>Sign in with a magic link instead</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
  },
});
