/** Vitest specs for AE412 Genie particle helpers. */
import { describe, expect, it } from 'vitest';
import {
  GENIE_DISSOLVE_MS,
  GENIE_PARTICLE_BASE_RADIUS,
  GENIE_PARTICLE_COUNT,
  canvasDimensions,
  easeInOutCubic,
  particleAt,
  particleInitialPosition,
  particleRadius,
  particleRestOpacity,
  particleRestPosition,
} from '../../src/components/aether/phase2/genie-particles';

describe('GENIE_* constants (pure)', () => {
  it('particle count is in the sensible SVG range', () => {
    expect(GENIE_PARTICLE_COUNT).toBeGreaterThanOrEqual(40);
    expect(GENIE_PARTICLE_COUNT).toBeLessThanOrEqual(400);
  });
  it('base radius reads as dust (1-5px)', () => {
    expect(GENIE_PARTICLE_BASE_RADIUS).toBeGreaterThanOrEqual(1);
    expect(GENIE_PARTICLE_BASE_RADIUS).toBeLessThanOrEqual(5);
  });
  it('dissolve duration is deliberate but not slow (≥ 400 ≤ 1500 ms)', () => {
    expect(GENIE_DISSOLVE_MS).toBeGreaterThanOrEqual(400);
    expect(GENIE_DISSOLVE_MS).toBeLessThanOrEqual(1500);
  });
});

describe('easeInOutCubic (pure)', () => {
  it('clamps below 0 to 0', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0)).toBe(0);
  });
  it('clamps above 1 to 1', () => {
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(2)).toBe(1);
  });
  it('symmetrical around 0.5', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });
  it('eases from 0 at 0 to 1 at 1 monotonically', () => {
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
  it('NaN → 0', () => {
    expect(easeInOutCubic(Number.NaN)).toBe(0);
  });
});

describe('particleRadius (pure)', () => {
  it('is deterministic for the same index', () => {
    expect(particleRadius(7)).toBe(particleRadius(7));
  });
  it('stays bounded above zero and around base × ~2', () => {
    const base = GENIE_PARTICLE_BASE_RADIUS;
    for (let i = 0; i < 50; i++) {
      const r = particleRadius(i, base);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(base * 2.5);
    }
  });
  it('honours custom base radius', () => {
    expect(particleRadius(0, 10)).toBeGreaterThan(particleRadius(0, 1));
  });
});

describe('particleRestOpacity (pure)', () => {
  it('deterministic per index', () => {
    expect(particleRestOpacity(13)).toBe(particleRestOpacity(13));
  });
  it('stays inside [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const o = particleRestOpacity(i);
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});

describe('particleInitialPosition (pure)', () => {
  it('stays inside the viewport', () => {
    for (let i = 0; i < 50; i++) {
      const p = particleInitialPosition(i, 1024, 768);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1024);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(768);
    }
  });
  it('deterministic per (i, w, h)', () => {
    const a = particleInitialPosition(5, 1024, 768);
    const b = particleInitialPosition(5, 1024, 768);
    expect(a).toEqual(b);
  });
});

describe('particleRestPosition (pure)', () => {
  it('clusters in the lower third (y ≈ height × 2/3)', () => {
    const cy = (768 * 2) / 3;
    for (let i = 0; i < 60; i++) {
      const p = particleRestPosition(i, 1024, 768);
      // Allow for ring radius + jitter (~ 0.18×min + 24px).
      expect(Math.abs(p.y - cy)).toBeLessThan(180);
    }
  });
  it('spreads angularly around the centre', () => {
    const cx = 1024 / 2;
    const cy = (768 * 2) / 3;
    const xs = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const p = particleRestPosition(i, 1024, 768, 60);
      // Make sure we see particles on BOTH sides of cx
      xs.add(p.x < cx ? -1 : 1);
    }
    expect(xs.has(-1)).toBe(true);
    expect(xs.has(1)).toBe(true);
    // cy used implicitly above; reference to keep the helper alive.
    expect(cy).toBeGreaterThan(0);
  });
  it('honours custom ring radius', () => {
    const close = particleRestPosition(0, 1024, 768, 60, 10);
    const far = particleRestPosition(0, 1024, 768, 60, 100);
    const cx = 1024 / 2;
    const cy = (768 * 2) / 3;
    const dClose = Math.hypot(close.x - cx, close.y - cy);
    const dFar = Math.hypot(far.x - cx, far.y - cy);
    expect(dFar).toBeGreaterThan(dClose);
  });
});

describe('particleAt (pure)', () => {
  it('t=0 matches the initial position', () => {
    const initial = particleInitialPosition(3, 1024, 768);
    const live = particleAt(3, 0, 1024, 768);
    expect(live.x).toBeCloseTo(initial.x, 5);
    expect(live.y).toBeCloseTo(initial.y, 5);
    expect(live.opacity).toBe(0);
  });
  it('t=1 matches the rest position', () => {
    const rest = particleRestPosition(3, 1024, 768);
    const live = particleAt(3, 1, 1024, 768);
    expect(live.x).toBeCloseTo(rest.x, 5);
    expect(live.y).toBeCloseTo(rest.y, 5);
    expect(live.opacity).toBeCloseTo(particleRestOpacity(3), 5);
  });
  it('opacity grows monotonically with t', () => {
    const a = particleAt(3, 0.2, 1024, 768);
    const b = particleAt(3, 0.6, 1024, 768);
    const c = particleAt(3, 0.9, 1024, 768);
    expect(b.opacity).toBeGreaterThan(a.opacity);
    expect(c.opacity).toBeGreaterThan(b.opacity);
  });
  it('NaN t collapses safely to 0 (no NaN positions)', () => {
    const live = particleAt(3, Number.NaN, 1024, 768);
    expect(Number.isFinite(live.x)).toBe(true);
    expect(Number.isFinite(live.y)).toBe(true);
    expect(live.opacity).toBe(0);
  });
});

describe('canvasDimensions (pure)', () => {
  it('passes through valid dimensions', () => {
    expect(canvasDimensions(1280, 800)).toEqual({ width: 1280, height: 800 });
  });
  it('substitutes defaults for null', () => {
    const d = canvasDimensions(null, null);
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
  });
  it('substitutes defaults for non-positive', () => {
    const d = canvasDimensions(0, -10);
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
  });
  it('substitutes defaults for NaN', () => {
    const d = canvasDimensions(Number.NaN, Number.NaN);
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
  });
});
