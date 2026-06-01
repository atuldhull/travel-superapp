/**
 * AE515 — barrel shape-gate + renderer-policy spec for
 * @app/aether-canvas-native.
 *
 * Pins:
 * 1. The barrel resolves + the version marker is present.
 * 2. The canvas-shared re-export carries the well-known pure helpers
 *    through (so native scenes can import everything from one path).
 * 3. The renderer policy table matches the Phase 4 decision lock:
 *    depth surfaces -> r3f-native, flat -> skia.
 * 4. Every known SurfaceId resolves to a valid renderer.
 */
import * as Native from '../src';
import type { SurfaceId } from '@app/aether-core';

const ALL_SURFACES: SurfaceId[] = [
  'drift',
  'atlas',
  'lumen',
  'genie',
  'compass',
  'echo',
  'pulse',
  'vault',
  'mirror',
  'continuum',
];

describe('AE515 — @app/aether-canvas-native barrel', () => {
  it('exports the version marker', () => {
    expect(typeof Native.AETHER_CANVAS_NATIVE_VERSION).toBe('string');
    expect(Native.AETHER_CANVAS_NATIVE_VERSION.length).toBeGreaterThan(0);
  });

  it('re-exports the canvas-shared pure math via the barrel', () => {
    // Sample the well-known pure helpers; full coverage at the
    // canvas-shared own shape-gate spec.
    expect(typeof Native.cameraPoseAt).toBe('function');
    expect(typeof Native.easedPhaseProgress).toBe('function');
    expect(typeof Native.pulseBreathAt).toBe('function');
    expect(typeof Native.glyphRingPosition).toBe('function');
    expect(typeof Native.latLngToVec3).toBe('function');
  });
});

describe('AE515 — rendererForSurface policy table', () => {
  it('depth surfaces map to r3f-native', () => {
    expect(Native.rendererForSurface('drift')).toBe('r3f-native');
    expect(Native.rendererForSurface('atlas')).toBe('r3f-native');
    expect(Native.rendererForSurface('lumen')).toBe('r3f-native');
    expect(Native.rendererForSurface('genie')).toBe('r3f-native');
    expect(Native.rendererForSurface('compass')).toBe('r3f-native');
    expect(Native.rendererForSurface('vault')).toBe('r3f-native');
    expect(Native.rendererForSurface('echo')).toBe('r3f-native');
  });

  it('flat surfaces map to skia', () => {
    expect(Native.rendererForSurface('pulse')).toBe('skia');
    expect(Native.rendererForSurface('mirror')).toBe('skia');
    expect(Native.rendererForSurface('continuum')).toBe('skia');
  });

  it('every known SurfaceId resolves to a defined renderer', () => {
    for (const id of ALL_SURFACES) {
      expect(['r3f-native', 'skia']).toContain(Native.rendererForSurface(id));
    }
  });

  it('unknown SurfaceIds fall back to r3f-native', () => {
    expect(Native.rendererForSurface('not-a-real-surface' as SurfaceId)).toBe('r3f-native');
  });
});

describe('AE515 — r3fNativeSurfaceIds + skiaSurfaceIds partition', () => {
  it('returns disjoint sets', () => {
    const r3f = new Set(Native.r3fNativeSurfaceIds());
    const skia = new Set(Native.skiaSurfaceIds());
    for (const id of r3f) {
      expect(skia.has(id)).toBe(false);
    }
  });

  it('together cover every entry in the policy table', () => {
    const r3f = Native.r3fNativeSurfaceIds();
    const skia = Native.skiaSurfaceIds();
    const total = new Set([...r3f, ...skia]);
    // The policy table has exactly the 10 known Surfaces.
    expect(total.size).toBe(10);
  });

  it('r3f set contains drift + atlas + lumen + genie + compass + vault + echo', () => {
    const r3f = new Set(Native.r3fNativeSurfaceIds());
    for (const id of ['drift', 'atlas', 'lumen', 'genie', 'compass', 'vault', 'echo'] as const) {
      expect(r3f.has(id)).toBe(true);
    }
  });

  it('skia set contains pulse + mirror + continuum', () => {
    const skia = new Set(Native.skiaSurfaceIds());
    for (const id of ['pulse', 'mirror', 'continuum'] as const) {
      expect(skia.has(id)).toBe(true);
    }
  });
});
