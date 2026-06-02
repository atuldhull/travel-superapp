/**
 * `/aether/compass` — full-screen Compass surface route (Phase 4 AE544).
 *
 * Mounts <AetherCompassScene/> (AE543, the bird-mode rose). A future
 * slice feeds the real device heading via expo-location; for now the
 * scene self-sweeps in demo mode.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Threads
 * useReducedMotionNative so the demo sweep freezes under OS Reduce
 * Motion.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherCompassScene } from '../../src/aether/compass-scene';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';
import { useDeviceHeading } from '../../lib/use-device-heading';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function CompassRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();
  // Real device heading (null when unavailable → scene self-sweeps).
  const heading = useDeviceHeading();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Compass' }} />
        <Text style={styles.noticeTitle}>Compass is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Compass.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Compass', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherCompassScene headingDegrees={heading ?? undefined} reducedMotion={reducedMotion} />
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
