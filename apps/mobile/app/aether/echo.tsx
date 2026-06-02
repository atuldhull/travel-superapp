/**
 * `/aether/echo` — full-screen Echo surface route (Phase 4 AE552).
 *
 * Mounts <AetherEchoScene/> (AE551, the social-feed card stack)
 * rendering the shared SAMPLE_ECHO_FEED fixture. A future slice wires
 * the real social feed channel + the swipe gesture.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Threads
 * useReducedMotionNative.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherEchoScene } from '../../src/aether/echo-scene';
import { SAMPLE_ECHO_FEED } from '../../src/aether/sample-echo';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function EchoRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Echo' }} />
        <Text style={styles.noticeTitle}>Echo is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Echo.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Echo', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherEchoScene feed={SAMPLE_ECHO_FEED} reducedMotion={reducedMotion} />
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
