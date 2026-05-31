/** Vitest specs for AE389 Pulse breathing math. */
import { describe, expect, it } from 'vitest';
import {
  moodFromPhase,
  pulseBreathAt,
  pulseBreathParams,
  pulseBreathStatic,
  type PulseMood,
} from '../../src/components/aether/phase1/pulse-breathing';

describe('moodFromPhase (pure)', () => {
  it('maps each surface phase to a Pulse mood', () => {
    expect(moodFromPhase('idle')).toBe<PulseMood>('sleeping');
    expect(moodFromPhase('materialising')).toBe<PulseMood>('speaking');
    expect(moodFromPhase('settling')).toBe<PulseMood>('listening');
    expect(moodFromPhase('listening')).toBe<PulseMood>('idle');
    expect(moodFromPhase('dissolving')).toBe<PulseMood>('speaking');
  });
});

describe('pulseBreathParams (pure)', () => {
  it('idle period matches the docs’ 8-second cycle', () => {
    expect(pulseBreathParams('idle').periodMs).toBe(8000);
  });
  it('listening is the brightest envelope', () => {
    const idle = pulseBreathParams('idle');
    const listening = pulseBreathParams('listening');
    expect(listening.opacityMax).toBeGreaterThan(idle.opacityMax);
    expect(listening.periodMs).toBeLessThan(idle.periodMs);
  });
  it('speaking is the fastest cycle', () => {
    const all: ReadonlyArray<PulseMood> = ['idle', 'listening', 'speaking', 'sleeping'];
    for (const m of all) {
      if (m === 'speaking') continue;
      expect(pulseBreathParams('speaking').periodMs).toBeLessThanOrEqual(
        pulseBreathParams(m).periodMs,
      );
    }
  });
  it('sleeping is the dimmest + smallest envelope', () => {
    const sleeping = pulseBreathParams('sleeping');
    const idle = pulseBreathParams('idle');
    // sleeping is strictly dimmer (almost gone — well below idle's
    // floor) but its size envelope touches idle's at 0.92 by design
    // so the wake-up transition feels continuous.
    expect(sleeping.opacityMax).toBeLessThan(idle.opacityMin);
    expect(sleeping.scaleMax).toBeLessThanOrEqual(idle.scaleMin);
    expect(sleeping.scaleMin).toBeLessThan(idle.scaleMin);
  });
  it('every envelope is monotonic min ≤ max', () => {
    const all: ReadonlyArray<PulseMood> = ['idle', 'listening', 'speaking', 'sleeping'];
    for (const m of all) {
      const p = pulseBreathParams(m);
      expect(p.scaleMin).toBeLessThanOrEqual(p.scaleMax);
      expect(p.opacityMin).toBeLessThanOrEqual(p.opacityMax);
      expect(p.opacityMin).toBeGreaterThanOrEqual(0);
      expect(p.opacityMax).toBeLessThanOrEqual(1);
    }
  });
});

describe('pulseBreathAt (pure)', () => {
  it('t=0 sits exactly at the lerp midpoint (sin(0) = 0)', () => {
    const p = pulseBreathParams('idle');
    const out = pulseBreathAt('idle', 0);
    expect(out.scale).toBeCloseTo((p.scaleMin + p.scaleMax) / 2, 9);
    expect(out.opacity).toBeCloseTo((p.opacityMin + p.opacityMax) / 2, 9);
  });

  it('quarter cycle reaches the envelope max (sin(π/2) = 1)', () => {
    const p = pulseBreathParams('idle');
    const out = pulseBreathAt('idle', p.periodMs / 4);
    expect(out.scale).toBeCloseTo(p.scaleMax, 9);
    expect(out.opacity).toBeCloseTo(p.opacityMax, 9);
  });

  it('three-quarter cycle reaches the envelope min (sin(3π/2) = -1)', () => {
    const p = pulseBreathParams('idle');
    const out = pulseBreathAt('idle', (p.periodMs * 3) / 4);
    expect(out.scale).toBeCloseTo(p.scaleMin, 9);
    expect(out.opacity).toBeCloseTo(p.opacityMin, 9);
  });

  it('full cycle wraps back to t=0 (periodic)', () => {
    const at0 = pulseBreathAt('listening', 0);
    const atWrap = pulseBreathAt('listening', 1800);
    expect(atWrap.scale).toBeCloseTo(at0.scale, 9);
    expect(atWrap.opacity).toBeCloseTo(at0.opacity, 9);
  });

  it('multiple periods wrap correctly (t mod period)', () => {
    const at0 = pulseBreathAt('speaking', 0);
    const at3periods = pulseBreathAt('speaking', 600 * 3);
    expect(at3periods.scale).toBeCloseTo(at0.scale, 9);
  });

  it('negative t clamps to 0', () => {
    const at0 = pulseBreathAt('idle', 0);
    const atNeg = pulseBreathAt('idle', -1000);
    expect(atNeg.scale).toBeCloseTo(at0.scale, 9);
    expect(atNeg.opacity).toBeCloseTo(at0.opacity, 9);
  });

  it('non-finite t (NaN, ±Infinity) resolves to the midpoint', () => {
    const mid = pulseBreathAt('idle', 0); // midpoint by definition of sin(0)
    for (const t of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const out = pulseBreathAt('idle', t);
      expect(out.scale).toBeCloseTo(mid.scale, 9);
      expect(out.opacity).toBeCloseTo(mid.opacity, 9);
    }
  });

  it('stays within the envelope for any t (sampled)', () => {
    const p = pulseBreathParams('listening');
    for (let i = 0; i < 50; i++) {
      const t = i * 137; // pseudo-arbitrary step
      const out = pulseBreathAt('listening', t);
      expect(out.scale).toBeGreaterThanOrEqual(p.scaleMin - 1e-9);
      expect(out.scale).toBeLessThanOrEqual(p.scaleMax + 1e-9);
      expect(out.opacity).toBeGreaterThanOrEqual(p.opacityMin - 1e-9);
      expect(out.opacity).toBeLessThanOrEqual(p.opacityMax + 1e-9);
    }
  });
});

describe('pulseBreathStatic (pure)', () => {
  it('returns the same midpoint as pulseBreathAt(t=0) for every mood', () => {
    const all: ReadonlyArray<PulseMood> = ['idle', 'listening', 'speaking', 'sleeping'];
    for (const m of all) {
      const live = pulseBreathAt(m, 0);
      const stat = pulseBreathStatic(m);
      expect(stat.scale).toBeCloseTo(live.scale, 9);
      expect(stat.opacity).toBeCloseTo(live.opacity, 9);
    }
  });

  it('does not depend on time (idempotent)', () => {
    const a = pulseBreathStatic('listening');
    const b = pulseBreathStatic('listening');
    expect(a.scale).toBe(b.scale);
    expect(a.opacity).toBe(b.opacity);
  });
});
