/**
 * `/aether/mirror` — full-screen Mirror surface route (Phase 4 AE557).
 *
 * Mounts <AetherMirrorScene/> (AE556, the Skia audit strip) rendering
 * the synthetic buildSampleAuditRows feed. Real admin data + the
 * isMirrorViewer role gate land when the admin audit stream is wired
 * (operator-owed) — for now the route is flag-gated like the others.
 *
 * The audit rows are built relative to Date.now() so they stay inside
 * the 60s river window + always read as live.
 */
import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AetherMirrorScene } from '../../src/aether/mirror-scene';
import { buildSampleAuditRows } from '../../src/aether/sample-mirror';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

export default function MirrorRoute(): React.ReactElement {
  // Build the rows + the clock once at mount so the fade reads stable.
  const { rows, now } = useMemo(() => {
    const t = Date.now();
    return { rows: buildSampleAuditRows(t), now: t };
  }, []);

  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Mirror' }} />
        <Text style={styles.noticeTitle}>Mirror is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Mirror.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Mirror',
          headerTintColor: '#F2E8D5',
          headerStyle: { backgroundColor: '#1A1714' },
        }}
      />
      <AetherMirrorScene rows={rows} now={now} />
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
