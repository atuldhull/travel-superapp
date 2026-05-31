/** Vitest specs for AE379 compass-rose pure helpers. */
import { describe, expect, it } from 'vitest';
import {
  CARDINALS,
  angularDistance,
  bearingPositionOnRing,
  bearingToVec3,
  cardinalAt,
  normalizeBearing,
} from '../../src/components/aether/phase1/compass-rose';

describe('normalizeBearing', () => {
  it('passes values in [0, 360) unchanged', () => {
    expect(normalizeBearing(0)).toBe(0);
    expect(normalizeBearing(90)).toBe(90);
    expect(normalizeBearing(359)).toBe(359);
  });

  it('wraps 360 → 0', () => {
    expect(normalizeBearing(360)).toBe(0);
    expect(normalizeBearing(720)).toBe(0);
  });

  it('wraps over-range positives', () => {
    expect(normalizeBearing(370)).toBe(10);
    expect(normalizeBearing(450)).toBe(90);
  });

  it('wraps negatives back into range', () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(-450)).toBe(270);
  });

  it('non-finite collapses to 0', () => {
    expect(normalizeBearing(NaN)).toBe(0);
    expect(normalizeBearing(Infinity)).toBe(0);
    expect(normalizeBearing(-Infinity)).toBe(0);
  });
});

describe('bearingToVec3', () => {
  it('bearing 0° → +Z unit (north)', () => {
    const v = bearingToVec3(0);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBe(0);
    expect(v.z).toBeCloseTo(1, 6);
  });

  it('bearing 90° → +X unit (east)', () => {
    const v = bearingToVec3(90);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('bearing 180° → -Z unit (south)', () => {
    const v = bearingToVec3(180);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.z).toBeCloseTo(-1, 6);
  });

  it('bearing 270° → -X unit (west)', () => {
    const v = bearingToVec3(270);
    expect(v.x).toBeCloseTo(-1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('result is always a unit vector', () => {
    for (const b of [0, 30, 45, 60, 120, 225, 333, 360, -30]) {
      const v = bearingToVec3(b);
      const len = Math.hypot(v.x, v.y, v.z);
      expect(len).toBeCloseTo(1, 6);
    }
  });

  it('y is always 0 (XZ plane)', () => {
    for (const b of [0, 45, 137.5, 270, 315]) {
      expect(bearingToVec3(b).y).toBe(0);
    }
  });
});

describe('bearingPositionOnRing', () => {
  it('scales by radius linearly', () => {
    const v = bearingPositionOnRing(0, 5);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.z).toBeCloseTo(5, 6);
  });

  it('east at radius 2', () => {
    const v = bearingPositionOnRing(90, 2);
    expect(v.x).toBeCloseTo(2, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('radius 0 → origin regardless of bearing', () => {
    // Use toBeCloseTo not toBe: cos(157°) is negative, and `negative * 0`
    // in JS yields -0 which Object.is distinguishes from +0. The
    // mathematically-zero value is what matters here.
    const v = bearingPositionOnRing(157, 0);
    expect(v.x).toBeCloseTo(0, 9);
    expect(v.z).toBeCloseTo(0, 9);
  });
});

describe('CARDINALS', () => {
  it('lists 4 cardinals starting at North', () => {
    expect(CARDINALS.map((c) => c.label)).toEqual(['N', 'E', 'S', 'W']);
  });

  it('bearings are 0/90/180/270', () => {
    expect(CARDINALS.map((c) => c.bearing)).toEqual([0, 90, 180, 270]);
  });
});

describe('cardinalAt', () => {
  it('cardinals map to themselves', () => {
    expect(cardinalAt(0)).toBe('N');
    expect(cardinalAt(90)).toBe('E');
    expect(cardinalAt(180)).toBe('S');
    expect(cardinalAt(270)).toBe('W');
  });

  it('45° rounds clockwise to East (not North)', () => {
    expect(cardinalAt(45)).toBe('E');
  });

  it('boundaries snap correctly', () => {
    expect(cardinalAt(44.9)).toBe('N');
    expect(cardinalAt(45)).toBe('E');
    expect(cardinalAt(134.9)).toBe('E');
    expect(cardinalAt(135)).toBe('S');
    expect(cardinalAt(224.9)).toBe('S');
    expect(cardinalAt(225)).toBe('W');
    expect(cardinalAt(314.9)).toBe('W');
    expect(cardinalAt(315)).toBe('N');
  });

  it('handles negatives via normalize', () => {
    // -90 → 270 → 'W'
    expect(cardinalAt(-90)).toBe('W');
    // -45 → 315 → 'N' (315 is the start of the next 'N' arc per the
    // round-clockwise rule, so cardinalAt(315) snaps forward to 'N').
    expect(cardinalAt(-45)).toBe('N');
  });

  it('handles 360 = 0', () => {
    expect(cardinalAt(360)).toBe('N');
  });
});

describe('angularDistance', () => {
  it('zero distance to self', () => {
    expect(angularDistance(45, 45)).toBe(0);
  });

  it('90° apart', () => {
    expect(angularDistance(0, 90)).toBe(90);
  });

  it('180° is the maximum', () => {
    expect(angularDistance(0, 180)).toBe(180);
  });

  it('takes the short way around (not the long way)', () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(10, 350)).toBe(20);
  });

  it('handles negatives + over-range via normalize', () => {
    expect(angularDistance(-10, 10)).toBe(20);
    expect(angularDistance(370, 10)).toBe(0);
  });
});
