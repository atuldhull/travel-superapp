/**
 * `/aether/atlas` — full-screen Atlas surface route (Phase 4 AE540).
 *
 * Mounts <AetherAtlasScene/> (AE539, the second R3F-native surface)
 * with the SAMPLE_LEH_TRIP fixture so the orb field demos on a fresh
 * install. A future slice swaps the fixture for a real trip via
 * useTripControllerGetItinerary.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1 (mirror of the web flag).
 * Threads useReducedMotionNative so the field's idle rotation freezes
 * under OS Reduce Motion (decision #4).
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherAtlasScene } from '../../src/aether/atlas-scene';
import { SAMPLE_LEH_TRIP } from '../../src/aether/sample-trip';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function AtlasRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Atlas' }} />
        <Text style={styles.noticeTitle}>Atlas is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Atlas.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Atlas', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherAtlasScene days={SAMPLE_LEH_TRIP} reducedMotion={reducedMotion} />
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
