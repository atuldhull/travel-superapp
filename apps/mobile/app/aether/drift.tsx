/**
 * `/aether/drift` — full-screen Drift surface route (Phase 4 AE537).
 *
 * Mounts <AetherDriftScene/> (AE536, the first R3F-native surface) as
 * a full-bleed screen. Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1 (the
 * mobile mirror of the web NEXT_PUBLIC_FEATURE_AETHER_PHASE1 flag) — when
 * the flag is off the route shows a calm "not enabled" notice instead of
 * the scene so production builds (flag unset) never surface unfinished
 * Aether work.
 *
 * The OS Reduce Motion setting is threaded in via useReducedMotionNative
 * so the sun disk freezes when the user has Reduce Motion enabled
 * (decision #4).
 *
 * This is the first Aether mobile route. Future surface routes
 * (/aether/atlas, /aether/lumen, ...) follow the same shape.
 */
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherDriftScene } from '../../src/aether/drift-scene';
import { useReducedMotionNative } from '../../lib/use-reduced-motion-native';

/** Read the Phase 4 feature flag. EXPO_PUBLIC_* vars are inlined at
 *  build time by the Expo bundler, so this is a static check. */
const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function DriftRoute(): React.ReactElement {
  const reducedMotion = useReducedMotionNative();

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Drift' }} />
        <Text style={styles.noticeTitle}>Drift is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Drift.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: 'Drift', headerTransparent: true, headerTintColor: '#F2E8D5' }}
      />
      <AetherDriftScene reducedMotion={reducedMotion} />
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
