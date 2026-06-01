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

describe('glyphRingPosition (AE444 edge cases)', () => {
  it('single glyph sits at +radius on the X axis', () => {
    const pos = glyphRingPosition(0, 1);
    expect(pos[0]).toBeCloseTo(DEFAULT_VAULT_RING_RADIUS, 5);
    expect(pos[1]).toBeCloseTo(0, 5);
    expect(pos[2]).toBeCloseTo(0, 5);
  });
  it('Y coordinate is always 0 (ring is in the XZ plane)', () => {
    for (let i = 0; i < 8; i += 1) {
      expect(glyphRingPosition(i, 8)[1]).toBe(0);
    }
  });
  it('every glyph sits on a circle of the given radius', () => {
    const r = 3;
    for (let i = 0; i < 12; i += 1) {
      const [x, , z] = glyphRingPosition(i, 12, r);
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(r, 5);
    }
  });
  it('total = 0 collapses to total = 1 (safety against div-by-zero)', () => {
    const pos = glyphRingPosition(0, 0);
    expect(pos[0]).toBeCloseTo(DEFAULT_VAULT_RING_RADIUS, 5);
  });
  it('negative total collapses to 1 (Math.max guard)', () => {
    const pos = glyphRingPosition(0, -5);
    expect(pos[0]).toBeCloseTo(DEFAULT_VAULT_RING_RADIUS, 5);
  });
  it('index past total wraps via angle = i/total × 2π', () => {
    // index = total wraps back to the start position.
    const a = glyphRingPosition(0, 6);
    const b = glyphRingPosition(6, 6);
    expect(a[0]).toBeCloseTo(b[0], 5);
    expect(a[2]).toBeCloseTo(b[2], 5);
  });
  it('opposite indices in an even-total ring are anti-symmetric', () => {
    const a = glyphRingPosition(0, 4);
    const b = glyphRingPosition(2, 4);
    expect(a[0]).toBeCloseTo(-b[0], 5);
    expect(a[2]).toBeCloseTo(-b[2], 5);
  });
  it('custom radius scales the X/Z components linearly', () => {
    const r2 = glyphRingPosition(1, 4, 2);
    const r4 = glyphRingPosition(1, 4, 4);
    expect(r4[0]).toBeCloseTo(r2[0] * 2, 5);
    expect(r4[2]).toBeCloseTo(r2[2] * 2, 5);
  });
});

describe('glyphFloatY (AE444 edge cases)', () => {
  it('time = 0 + phase = 0 → amplitude × sin(0) = 0', () => {
    expect(glyphFloatY(0, 0)).toBeCloseTo(0, 5);
  });
  it('NaN time → 0', () => {
    expect(glyphFloatY(0, Number.NaN)).toBe(0);
  });
  it('Infinity time → 0 (defensive)', () => {
    expect(glyphFloatY(0, Number.POSITIVE_INFINITY)).toBe(0);
  });
  it('result stays bounded by amplitude', () => {
    for (let t = 0; t < 10; t += 0.13) {
      const y = glyphFloatY(3, t);
      expect(Math.abs(y)).toBeLessThanOrEqual(DEFAULT_VAULT_FLOAT_AMPLITUDE + 1e-9);
    }
  });
  it('phase offset per index breaks lock-step with neighbours', () => {
    // Two glyphs at the same time but different indices should
    // generally read different Y values (collisions are possible
    // but rare for our phase offset).
    expect(glyphFloatY(0, 0.5)).not.toBe(glyphFloatY(1, 0.5));
  });
});
