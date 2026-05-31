/**
 * Vitest specs for AE378 atlas-orbs pure layout math.
 *
 * Tests run in node env — atlas-orbs.ts has no React, no R3F, no DOM.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATLAS_LAYOUT,
  dayPositionOnAxis,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  orbZForSlot,
  type AtlasDayLike,
  type AtlasLayoutConfig,
} from '../../src/components/aether/phase1/atlas-orbs';

const AXIS = DEFAULT_ATLAS_LAYOUT.axisLength;

describe('dayPositionOnAxis', () => {
  it('single-day trip lands at origin', () => {
    expect(dayPositionOnAxis(0, 1, AXIS)).toBe(0);
  });

  it('two-day trip: index 0 = -axis/2, index 1 = +axis/2', () => {
    expect(dayPositionOnAxis(0, 2, AXIS)).toBe(-AXIS / 2);
    expect(dayPositionOnAxis(1, 2, AXIS)).toBe(AXIS / 2);
  });

  it('odd-length: middle day at zero', () => {
    expect(dayPositionOnAxis(2, 5, AXIS)).toBe(0);
  });

  it('clamps negative dayIndex to -axis/2', () => {
    expect(dayPositionOnAxis(-1, 5, AXIS)).toBe(-AXIS / 2);
  });

  it('clamps dayIndex past last to +axis/2', () => {
    expect(dayPositionOnAxis(99, 5, AXIS)).toBe(AXIS / 2);
  });

  it('totalDays=0 collapses to origin', () => {
    expect(dayPositionOnAxis(0, 0, AXIS)).toBe(0);
  });

  it('distances are monotonically increasing through the trip', () => {
    const total = 7;
    let prev = -Infinity;
    for (let i = 0; i < total; i += 1) {
      const x = dayPositionOnAxis(i, total, AXIS);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});

describe('orbZForSlot', () => {
  it('single slot lands at origin', () => {
    expect(orbZForSlot(0, 1, 0.5)).toBe(0);
  });

  it('two slots are symmetric around zero', () => {
    const a = orbZForSlot(0, 2, 0.5);
    const b = orbZForSlot(1, 2, 0.5);
    expect(a + b).toBeCloseTo(0, 6);
    expect(Math.abs(a)).toBeCloseTo(0.25, 6);
  });

  it('three slots: middle = 0, outer = ±spacing', () => {
    expect(orbZForSlot(1, 3, 0.5)).toBe(0);
    expect(orbZForSlot(0, 3, 0.5)).toBeCloseTo(-0.5, 6);
    expect(orbZForSlot(2, 3, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('spacing scales the spread linearly', () => {
    const tight = orbZForSlot(0, 2, 0.2);
    const wide = orbZForSlot(0, 2, 1.0);
    expect(Math.abs(wide / tight)).toBeCloseTo(5, 6);
  });
});

function dayOf(dayIndex: number, itemCount: number, date = '2026-06-01'): AtlasDayLike {
  return {
    id: `day-${dayIndex}`,
    dayIndex,
    date,
    items: Array.from({ length: itemCount }, (_, i) => ({
      id: `item-${dayIndex}-${i}`,
      position: i,
      placeId: `place-${i}`,
    })),
  };
}

describe('layoutOrbsForTrip', () => {
  it('empty days → empty output', () => {
    expect(layoutOrbsForTrip([])).toEqual([]);
  });

  it('renders one orb per item', () => {
    const days = [dayOf(0, 2), dayOf(1, 3)];
    const orbs = layoutOrbsForTrip(days);
    expect(orbs.length).toBe(5);
  });

  it('orbs from the same day share the same X', () => {
    const days = [dayOf(0, 3)];
    const orbs = layoutOrbsForTrip(days);
    const xs = new Set(orbs.map((o) => o.x));
    expect(xs.size).toBe(1);
  });

  it('orbs are stacked symmetrically around z = 0 within a day', () => {
    const days = [dayOf(0, 3)];
    const orbs = layoutOrbsForTrip(days);
    const zSum = orbs.reduce((acc, o) => acc + o.z, 0);
    expect(zSum).toBeCloseTo(0, 6);
  });

  it('items are sorted by position within a day', () => {
    const day: AtlasDayLike = {
      id: 'day-0',
      dayIndex: 0,
      date: '2026-06-01',
      items: [
        { id: 'a', position: 2, placeId: null },
        { id: 'b', position: 0, placeId: null },
        { id: 'c', position: 1, placeId: null },
      ],
    };
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs.map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('overflow past maxOrbsPerSlot collapses onto the last slot', () => {
    const config: AtlasLayoutConfig = { ...DEFAULT_ATLAS_LAYOUT, maxOrbsPerSlot: 3 };
    const days = [dayOf(0, 5)];
    const orbs = layoutOrbsForTrip(days, config);
    // 5 items: items 0..2 take slots 0..2; items 3 + 4 clamp to slot 2.
    // So orbs[2] (item-0-2), orbs[3] (item-0-3), orbs[4] (item-0-4)
    // should all share the same z position.
    expect(orbs[2]!.z).toBeCloseTo(orbs[3]!.z, 6);
    expect(orbs[3]!.z).toBeCloseTo(orbs[4]!.z, 6);
  });

  it('y is always 0 (AE378 keeps the timeline planar)', () => {
    const days = [dayOf(0, 2), dayOf(1, 4)];
    const orbs = layoutOrbsForTrip(days);
    for (const o of orbs) expect(o.y).toBe(0);
  });

  it('placeId passes through (including null)', () => {
    const day: AtlasDayLike = {
      id: 'd',
      dayIndex: 0,
      date: '2026-06-01',
      items: [
        { id: 'a', position: 0, placeId: 'p1' },
        { id: 'b', position: 1, placeId: null },
      ],
    };
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs[0]!.placeId).toBe('p1');
    expect(orbs[1]!.placeId).toBeNull();
  });
});

describe('layoutDayMarkers', () => {
  it('empty days → empty markers', () => {
    expect(layoutDayMarkers([])).toEqual([]);
  });

  it('emits one marker per day', () => {
    const days = [dayOf(0, 1), dayOf(1, 1), dayOf(2, 1)];
    expect(layoutDayMarkers(days).length).toBe(3);
  });

  it('marker x positions match dayPositionOnAxis', () => {
    const days = [dayOf(0, 1), dayOf(1, 1), dayOf(2, 1)];
    const markers = layoutDayMarkers(days);
    expect(markers[0]!.x).toBe(dayPositionOnAxis(0, 3, AXIS));
    expect(markers[1]!.x).toBe(dayPositionOnAxis(1, 3, AXIS));
    expect(markers[2]!.x).toBe(dayPositionOnAxis(2, 3, AXIS));
  });

  it('carries through date strings', () => {
    const days = [dayOf(0, 1, '2026-06-15'), dayOf(1, 1, '2026-06-16')];
    const markers = layoutDayMarkers(days);
    expect(markers[0]!.date).toBe('2026-06-15');
    expect(markers[1]!.date).toBe('2026-06-16');
  });
});

describe('orbSizeForItem + orbColorForItem', () => {
  const item = { id: 'x', position: 0, placeId: null };

  it('orbSizeForItem returns a positive number', () => {
    const size = orbSizeForItem(item);
    expect(size).toBeGreaterThan(0);
  });

  it('orbColorForItem passes through the theme accent', () => {
    expect(orbColorForItem(item, '#E8B777')).toBe('#E8B777');
    expect(orbColorForItem(item, 'rgb(232, 183, 119)')).toBe('rgb(232, 183, 119)');
  });
});
