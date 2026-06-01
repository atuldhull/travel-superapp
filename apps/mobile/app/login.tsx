/**
 * Phase 4 / Round AS (AE520) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 â€” sign-in screen. Same `/auth/login` endpoint the web app
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
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link, router } from 'expo-router';
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
      Alert.alert('Sign-in failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} - ${e.message}`);
    }
  }

  const submitting = login.isPending;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sign in</Text>
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
        placeholder="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? 'Signing in...' : 'Sign in'}</Text>
      </TouchableOpacity>
      <Link href="/register" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>New here? Create an account</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/auth/magic-link" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>Sign in with a magic link instead</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    flexDirection: 'column',
    gap: 12,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111111',
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 12,
    color: '#1f6feb',
    textAlign: 'center',
  },
});
