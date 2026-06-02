/**
 * `/aether/genie` — full-screen Genie surface route (Phase 4 AE555).
 *
 * Mounts <AetherGenieScene/> (AE554, the voice modal + particle swirl).
 * The FSM-driven mic demo runs without a real recording; real Whisper
 * STT + camera mode land as backend b-slices.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Threads
 * useReducedMotionNative.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherGenieScene } from '../../src/aether/genie-scene';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function GenieRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Genie' }} />
        <Text style={styles.noticeTitle}>Genie is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Genie.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Genie', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherGenieScene reducedMotion={reducedMotion} />
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
