/** AE396 — registry mount-loader symmetry for Phase 1 surfaces. */
import { describe, expect, it } from 'vitest';
import { createAetherPhase1Registry } from '../../src/components/aether/phase1/aether-registry';

const registry = createAetherPhase1Registry();
const surfaces = registry.list();

function byId(id: string) {
  return surfaces.find((s) => s.id === id);
}

describe('AE396 — Phase 1 registry shape', () => {
  it('drift / atlas / compass route-bound surfaces have mount loaders', () => {
    for (const id of ['drift', 'atlas', 'compass']) {
      const s = byId(id);
      expect(s, `${id} surface registered`).toBeDefined();
      expect(s?.route.kind).not.toBe('overlay');
      expect(typeof s?.mount).toBe('function');
    }
  });

  it('AE398 lumen + AE414 vault Phase 2 surfaces also have mount loaders', () => {
    for (const id of ['lumen', 'vault']) {
      const s = byId(id);
      expect(s, `${id} surface registered`).toBeDefined();
      expect(s?.route.kind).not.toBe('overlay');
      expect(typeof s?.mount).toBe('function');
    }
  });

  it('pulse overlay surface has a symmetric mount loader (AE396)', () => {
    const pulse = byId('pulse');
    expect(pulse).toBeDefined();
    expect(pulse?.route.kind).toBe('overlay');
    // AE396 wired the loader for Storybook / Mirror admin parity.
    expect(typeof pulse?.mount).toBe('function');
  });

  it('continuum overlay surface intentionally has no mount loader', () => {
    const continuum = byId('continuum');
    expect(continuum).toBeDefined();
    expect(continuum?.route.kind).toBe('overlay');
    // HTML-only rendering path — no R3F scene to load.
    expect(continuum?.mount).toBeUndefined();
  });

  it('every route-bound surface carries a palette', () => {
    for (const id of ['drift', 'atlas', 'compass']) {
      const s = byId(id);
      expect(s?.palette).toBeDefined();
      expect((s?.palette ?? []).length).toBe(5);
    }
  });

  it('pulse overlay carries its baseline palette (AE389)', () => {
    const pulse = byId('pulse');
    expect(pulse?.palette).toBeDefined();
    expect((pulse?.palette ?? []).length).toBe(5);
  });
});
