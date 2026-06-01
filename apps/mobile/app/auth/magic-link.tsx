/**
 * Phase 4 / Round AS (AE520) - Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 (sub-prompt 2) - magic-link request screen. Posts the
 * caller's email to `/auth/magic-link/request`; the api emails a
 * `travelapp://auth/magic-link/<token>` deep link that, when tapped,
 * launches the consume route below + signs the user in.
 *
 * Mirrors the web's V.UX.2 surface.
 *
 * Installed by prompt [V.UX.27].
 */
import { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
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
      Alert.alert('Send failed', `${e.code ?? `HTTP_${e.status ?? '???'}`} - ${e.message}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sign in with magic link</Text>
      {sent ? (
        <View style={styles.sentBlock}>
          <Text style={styles.bodyText}>Check your inbox for a sign-in link.</Text>
          <Text style={styles.helperText}>
            Tap the link in the email to land back here signed in.
          </Text>
        </View>
      ) : (
        <View style={styles.formBlock}>
          <TextInput
            style={styles.input}
            placeholder="email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity
            style={[styles.button, request.isPending && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={request.isPending}
          >
            <Text style={styles.buttonLabel}>
              {request.isPending ? 'Sending...' : 'Send magic link'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Link href="/login" asChild>
        <Text style={styles.backLink}>Back to password sign-in</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    justifyContent: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  sentBlock: {
    flexDirection: 'column',
    gap: 8,
  },
  formBlock: {
    flexDirection: 'column',
    gap: 12,
  },
  bodyText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#666666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
  },
});
