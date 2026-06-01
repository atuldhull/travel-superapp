/** Vitest specs for AE414 Vault R3F glyph helpers. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VAULT_BASE_SCALE,
  DEFAULT_VAULT_FLOAT_AMPLITUDE,
  DEFAULT_VAULT_FLOAT_FREQUENCY,
  DEFAULT_VAULT_PHASE_OFFSET,
  DEFAULT_VAULT_RING_RADIUS,
  glyphFloatY,
  glyphHaloIntensity,
  glyphRingPosition,
  glyphSphereScale,
} from '../../src/components/aether/phase2/vault-glyph-positions';

describe('DEFAULT_VAULT_* constants (pure)', () => {
  it('ring radius is positive', () => {
    expect(DEFAULT_VAULT_RING_RADIUS).toBeGreaterThan(0);
  });
  it('float amplitude reads as "hovering" (≤ 0.5 world units)', () => {
    expect(DEFAULT_VAULT_FLOAT_AMPLITUDE).toBeGreaterThan(0);
    expect(DEFAULT_VAULT_FLOAT_AMPLITUDE).toBeLessThanOrEqual(0.5);
  });
  it('float frequency cycles roughly every few seconds', () => {
    expect(DEFAULT_VAULT_FLOAT_FREQUENCY).toBeGreaterThan(0);
    expect(DEFAULT_VAULT_FLOAT_FREQUENCY).toBeLessThan(5);
  });
  it("phase offset is non-zero so neighbours don't bob in lock-step", () => {
    expect(DEFAULT_VAULT_PHASE_OFFSET).not.toBe(0);
  });
  it('base scale is sensible', () => {
    expect(DEFAULT_VAULT_BASE_SCALE).toBeGreaterThan(0);
    expect(DEFAULT_VAULT_BASE_SCALE).toBeLessThan(2);
  });
});

describe('glyphRingPosition (pure)', () => {
  it('index 0 sits at (+radius, 0, 0)', () => {
    const p = glyphRingPosition(0, 4);
    expect(p[0]).toBeCloseTo(DEFAULT_VAULT_RING_RADIUS, 5);
    expect(p[1]).toBe(0);
    expect(p[2]).toBeCloseTo(0, 5);
  });
  it('every position lies on the ring (x² + z² = r²)', () => {
    const r = DEFAULT_VAULT_RING_RADIUS;
    for (let i = 0; i < 8; i++) {
      const p = glyphRingPosition(i, 8);
      const distSq = p[0] * p[0] + p[2] * p[2];
      expect(distSq).toBeCloseTo(r * r, 5);
    }
  });
  it('positions are unique for a given total', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = glyphRingPosition(i, 6);
      keys.add(`${p[0].toFixed(4)},${p[2].toFixed(4)}`);
    }
    expect(keys.size).toBe(6);
  });
  it('honours custom radius', () => {
    const p = glyphRingPosition(0, 6, 10);
    expect(p[0]).toBeCloseTo(10, 5);
  });
  it('safe with total=0 (treats as 1)', () => {
    const p = glyphRingPosition(0, 0);
    expect(Number.isFinite(p[0])).toBe(true);
    expect(Number.isFinite(p[2])).toBe(true);
  });
});

describe('glyphFloatY (pure)', () => {
  it('amplitude bounds the output', () => {
    for (let t = 0; t < 10; t += 0.3) {
      for (let i = 0; i < 5; i++) {
        const y = glyphFloatY(i, t, 0.18);
        expect(Math.abs(y)).toBeLessThanOrEqual(0.18 + 1e-9);
      }
    }
  });
  it('t=0 with index 0 → 0', () => {
    expect(glyphFloatY(0, 0)).toBeCloseTo(0, 5);
  });
  it('different indices have different phases at the same t', () => {
    const a = glyphFloatY(0, 1);
    const b = glyphFloatY(1, 1);
    expect(a).not.toBe(b);
  });
  it('NaN time → 0 (no NaN positions in the scene)', () => {
    expect(glyphFloatY(2, Number.NaN)).toBe(0);
  });
  it('honours custom amplitude', () => {
    const a = glyphFloatY(0, 1, 1);
    expect(Math.abs(a)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('glyphSphereScale (pure)', () => {
  it('min amount → 0.7 × base', () => {
    expect(glyphSphereScale(100, 100, 500)).toBeCloseTo(0.7 * DEFAULT_VAULT_BASE_SCALE, 5);
  });
  it('max amount → 1.3 × base', () => {
    expect(glyphSphereScale(500, 100, 500)).toBeCloseTo(1.3 * DEFAULT_VAULT_BASE_SCALE, 5);
  });
  it('midpoint → 1.0 × base', () => {
    expect(glyphSphereScale(300, 100, 500)).toBeCloseTo(DEFAULT_VAULT_BASE_SCALE, 5);
  });
  it('out-of-range clamps to the boundary scale', () => {
    expect(glyphSphereScale(50, 100, 500)).toBeCloseTo(0.7 * DEFAULT_VAULT_BASE_SCALE, 5);
    expect(glyphSphereScale(600, 100, 500)).toBeCloseTo(1.3 * DEFAULT_VAULT_BASE_SCALE, 5);
  });
  it('degenerate range (min == max) → base', () => {
    expect(glyphSphereScale(100, 100, 100)).toBe(DEFAULT_VAULT_BASE_SCALE);
  });
  it('NaN inputs → base (safe fallback)', () => {
    expect(glyphSphereScale(Number.NaN, 100, 500)).toBe(DEFAULT_VAULT_BASE_SCALE);
    expect(glyphSphereScale(300, Number.NaN, 500)).toBe(DEFAULT_VAULT_BASE_SCALE);
  });
  it('honours custom base', () => {
    expect(glyphSphereScale(300, 100, 500, 2)).toBeCloseTo(2, 5);
  });
});

describe('glyphHaloIntensity (pure)', () => {
  it('returns 0 when not dropped', () => {
    expect(glyphHaloIntensity(false)).toBe(0);
  });
  it('returns the intensity when dropped', () => {
    expect(glyphHaloIntensity(true)).toBeCloseTo(0.35, 5);
  });
  it('honours custom intensity', () => {
    expect(glyphHaloIntensity(true, 0.8)).toBe(0.8);
  });
});
