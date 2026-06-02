/**
 * `/aether/continuum` — Continuum handoff route (Phase 4 AE541).
 *
 * Gives the Continuum sigil surface (AE531, Skia) a live route like
 * Drift + Atlas now have. Shows the handoff sigil for a sample
 * cross-device deep link alongside the link itself — the visual the
 * receiving device confirms at a glance (docs/aether/02-surfaces.md
 * section 10).
 *
 * The seed is derived from a sample ContinuumState via continuumSigilSeed
 * (the canonical sans-origin URL) so the rendered sigil matches what the
 * web Continuum bar would paint for the same handoff. A future slice
 * wires this to the real active-surface state.
 *
 * Gated by EXPO_PUBLIC_FEATURE_AETHER_PHASE1.
 */
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { continuumSigilSeed, type ContinuumState } from '@app/aether-canvas-shared';
import { AetherContinuumSigil } from '../../src/aether/continuum-sigil';

const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

/** Sample handoff — "the Leh trip studio, focused on Pangong". */
const SAMPLE_STATE: ContinuumState = {
  pathname: '/aether/atlas',
  extras: { trip: 'leh-2026', focus: 'place-pangong-lake' },
};

const SAMPLE_SEED = continuumSigilSeed(SAMPLE_STATE);

export default function ContinuumRoute(): React.ReactElement {
  if (!AETHER_ENABLED) {
    return (
      <View style={styles.notice}>
        <Stack.Screen options={{ title: 'Continuum' }} />
        <Text style={styles.noticeTitle}>Continuum is not enabled</Text>
        <Text style={styles.noticeBody}>
          The Aether surfaces are gated behind EXPO_PUBLIC_FEATURE_AETHER_PHASE1. Enable it in a
          development or preview build to explore Continuum.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Continuum' }} />
      <Text style={styles.heading}>Hand off to another device</Text>
      <Text style={styles.body}>
        Scan or confirm this sigil on your other device to continue right where you are.
      </Text>
      <View style={styles.sigilWrap}>
        <AetherContinuumSigil seed={SAMPLE_SEED} />
      </View>
      <Text style={styles.linkLabel}>Deep link</Text>
      <Text style={styles.link} numberOfLines={2}>
        {SAMPLE_SEED}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#F2E8D5',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1714',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6E6155',
    textAlign: 'center',
    lineHeight: 20,
  },
  sigilWrap: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6E7B5C',
  },
  link: {
    fontSize: 13,
    color: '#C2614A',
    textAlign: 'center',
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
