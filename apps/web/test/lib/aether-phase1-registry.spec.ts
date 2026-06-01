/**
 * Vitest specs for AE377 `createAetherPhase1Registry`.
 *
 * Pure factory — no jsdom needed. Verifies the Phase 1 surfaces are
 * registered in the right shape so the SurfaceManager + SurfaceCanvas
 * can pick them up.
 */
import { describe, expect, it } from 'vitest';
import { createAetherPhase1Registry } from '../../src/components/aether/phase1/aether-registry';

describe('createAetherPhase1Registry', () => {
  it('registers all Phase 1 + Phase 2 + Phase 3 scaffolded surfaces', () => {
    const r = createAetherPhase1Registry();
    // 5 Phase 1 + 2 Phase 2 (Lumen AE398 + Vault AE407)
    // + 2 Phase 3 (Echo AE418 + Mirror AE421).
    expect(r.size).toBe(9);
    const ids = r.list().map((s) => s.id);
    expect(ids).toEqual([
      'drift',
      'atlas',
      'compass',
      'pulse',
      'continuum',
      'lumen',
      'vault',
      'echo',
      'mirror',
    ]);
  });

  it('phase numbers match the surface origin (1 vs 2 vs 3)', () => {
    const r = createAetherPhase1Registry();
    for (const s of r.list()) {
      if (s.id === 'echo' || s.id === 'mirror') {
        expect(s.phase).toBe(3);
        continue;
      }
      if (s.id === 'lumen' || s.id === 'vault') {
        expect(s.phase).toBe(2);
        continue;
      }
      expect(s.phase).toBe(1);
    }
  });

  it('drift is route-bound to /aether/drift with a mount loader', () => {
    const r = createAetherPhase1Registry();
    const drift = r.findById('drift');
    expect(drift).toBeDefined();
    expect(drift!.route.kind).toBe('literal');
    if (drift!.route.kind === 'literal') {
      expect(drift!.route.pathname).toBe('/aether/drift');
    }
    expect(typeof drift!.mount).toBe('function');
  });

  it('atlas pattern matches /aether/journey/:id', () => {
    const r = createAetherPhase1Registry();
    const atlas = r.findById('atlas');
    expect(atlas!.route.kind).toBe('pattern');
    if (atlas!.route.kind === 'pattern') {
      expect(atlas!.route.pathname).toBe('/aether/journey/:id');
    }
  });

  it('compass is route-bound to /aether/atlas (Bird mode)', () => {
    const r = createAetherPhase1Registry();
    const compass = r.findById('compass');
    expect(compass!.route.kind).toBe('literal');
    if (compass!.route.kind === 'literal') {
      expect(compass!.route.pathname).toBe('/aether/atlas');
    }
  });

  it('pulse + continuum are overlays', () => {
    const r = createAetherPhase1Registry();
    expect(r.findById('pulse')!.route.kind).toBe('overlay');
    expect(r.findById('continuum')!.route.kind).toBe('overlay');
  });

  it('drift has a curated keySignature slug', () => {
    const r = createAetherPhase1Registry();
    const drift = r.findById('drift');
    expect(typeof drift!.keySignature).toBe('string');
    expect(drift!.keySignature!.length).toBeGreaterThan(0);
  });

  it('drift palette has 5 hex entries (matches 01-architecture k-means contract)', () => {
    const r = createAetherPhase1Registry();
    const palette = r.findById('drift')!.palette;
    expect(palette).toBeDefined();
    expect(palette!.length).toBe(5);
    for (const c of palette!) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each call returns a fresh registry (no shared mutable state)', () => {
    const a = createAetherPhase1Registry();
    const b = createAetherPhase1Registry();
    expect(a).not.toBe(b);
    expect(a.size).toBe(b.size);
  });
});
