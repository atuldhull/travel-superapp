/**
 * `/aether/vault` — full-screen Vault surface route (Phase 4 AE546).
 *
 * Mounts <AetherVaultScene/> (AE545, the floating price-glyph ring)
 * rendering the shared SAMPLE_VAULT_PRICES catalogue. A future slice
 * wires the real price feed + the tap-to-checkout panel.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Threads
 * useReducedMotionNative so the ring + glyph bob freeze under OS Reduce
 * Motion.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherVaultScene } from '../../src/aether/vault-scene';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function VaultRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Vault' }} />
        <Text style={styles.noticeTitle}>Vault is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Vault.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Vault', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherVaultScene reducedMotion={reducedMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1714',
  },
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#F2E8D5',
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1714',
    textAlign: 'center',
  },
  noticeBody: {
    fontSize: 14,
    color: '#6E6155',
    textAlign: 'center',
    lineHeight: 20,
  },
});
