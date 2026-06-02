/**
 * `/aether/lumen` — full-screen Lumen surface route (Phase 4 AE550).
 *
 * Mounts <AetherLumenScene/> (AE549, the photo cloud) rendering the
 * shared SAMPLE_LUMEN_PHOTOS fixture. A future slice wires a real
 * memory book + photo textures.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Threads
 * useReducedMotionNative.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherLumenScene } from '../../src/aether/lumen-scene';
import { SAMPLE_LUMEN_PHOTOS } from '../../src/aether/sample-lumen';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function LumenRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Lumen' }} />
        <Text style={styles.noticeTitle}>Lumen is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Lumen.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Lumen', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherLumenScene photos={SAMPLE_LUMEN_PHOTOS} reducedMotion={reducedMotion} />
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
