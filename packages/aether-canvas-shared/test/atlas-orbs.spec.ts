/**
 * AE509 - canvas-shared own behavioural spec for the Atlas Phase 1 orb
 * layout math shipped in AE456 / AE378.
 *
 * Covers:
 *   - DEFAULT_ATLAS_LAYOUT constant values
 *   - dayPositionOnAxis distribution across the timeline (zero / single
 *     / multi-day, boundary dayIndex saturation, interior interpolation)
 *   - orbZForSlot symmetric centring around z=0 + spacing math
 *   - layoutOrbsForTrip output shape, ordering by item position,
 *     maxOrbsPerSlot clamping, multi-day cross-axis spread, empty input
 *   - layoutDayMarkers per-day marker pairing
 *   - orbSizeForItem fixed default + orbColorForItem theme passthrough
 *
 * Imports only from the package barrel so the helpers stay shippable to
 * any consumer that re-exports `@app/aether-canvas-shared`.
 */

import {
  DEFAULT_ATLAS_LAYOUT,
  dayPositionOnAxis,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  orbZForSlot,
  type AtlasDayLike,
  type AtlasItemLike,
  type AtlasLayoutConfig,
} from '../src';

const ITEM = (overrides: Partial<AtlasItemLike> = {}): AtlasItemLike => ({
  id: 'item-1',
  position: 0,
  placeId: 'place-1',
  ...overrides,
});

const DAY = (overrides: Partial<AtlasDayLike> = {}): AtlasDayLike => ({
  id: 'day-1',
  dayIndex: 0,
  date: '2026-06-01',
  items: [],
  ...overrides,
});

describe('AE509 - DEFAULT_ATLAS_LAYOUT', () => {
  it('pins axisLength to 16 world units (AE375 camera tuning)', () => {
    expect(DEFAULT_ATLAS_LAYOUT.axisLength).toBe(16);
  });

  it('pins orbZSpacing to 0.45 world units', () => {
    expect(DEFAULT_ATLAS_LAYOUT.orbZSpacing).toBe(0.45);
  });

  it('pins maxOrbsPerSlot to 6 stacks per day', () => {
    expect(DEFAULT_ATLAS_LAYOUT.maxOrbsPerSlot).toBe(6);
  });
});

describe('AE509 - dayPositionOnAxis', () => {
  it('returns 0 when totalDays is 0 (no-op fallback)', () => {
    expect(dayPositionOnAxis(0, 0, 16)).toBe(0);
  });

  it('returns 0 when totalDays is negative (defensive fallback)', () => {
    expect(dayPositionOnAxis(0, -3, 16)).toBe(0);
  });

  it('returns 0 when totalDays is exactly 1 (single-day trip lands at origin)', () => {
    expect(dayPositionOnAxis(0, 1, 16)).toBe(0);
  });

  it('clamps dayIndex below 0 to the left edge -axisLength/2', () => {
    expect(dayPositionOnAxis(-2, 5, 16)).toBe(-8);
  });

  it('places dayIndex 0 at the left edge -axisLength/2 for multi-day', () => {
    expect(dayPositionOnAxis(0, 5, 16)).toBe(-8);
  });

  it('places the final dayIndex at the right edge +axisLength/2', () => {
    expect(dayPositionOnAxis(4, 5, 16)).toBe(8);
  });

  it('clamps dayIndex above totalDays-1 to the right edge', () => {
    expect(dayPositionOnAxis(99, 5, 16)).toBe(8);
  });

  it('places the midpoint day of an odd trip at x=0', () => {
    expect(dayPositionOnAxis(2, 5, 16)).toBe(0);
  });

  it('interpolates interior days linearly (day 1 of 5 = -4 on axisLength 16)', () => {
    expect(dayPositionOnAxis(1, 5, 16)).toBe(-4);
  });

  it('interpolates interior days linearly (day 3 of 5 = +4 on axisLength 16)', () => {
    expect(dayPositionOnAxis(3, 5, 16)).toBe(4);
  });

  it('scales with a different axisLength', () => {
    expect(dayPositionOnAxis(0, 3, 20)).toBe(-10);
    expect(dayPositionOnAxis(2, 3, 20)).toBe(10);
  });
});

describe('AE509 - orbZForSlot', () => {
  it('returns 0 when totalSlots is 1 (single orb sits on axis)', () => {
    expect(orbZForSlot(0, 1, 0.45)).toBe(0);
  });

  it('returns 0 when totalSlots is 0 (defensive guard)', () => {
    expect(orbZForSlot(0, 0, 0.45)).toBe(0);
  });

  it('centres two orbs symmetrically around z=0', () => {
    expect(orbZForSlot(0, 2, 0.45)).toBeCloseTo(-0.225, 6);
    expect(orbZForSlot(1, 2, 0.45)).toBeCloseTo(0.225, 6);
  });

  it('places the middle of three orbs exactly on z=0', () => {
    expect(orbZForSlot(1, 3, 0.45)).toBe(0);
  });

  it('spreads three orbs symmetrically by spacing', () => {
    expect(orbZForSlot(0, 3, 0.45)).toBeCloseTo(-0.45, 6);
    expect(orbZForSlot(2, 3, 0.45)).toBeCloseTo(0.45, 6);
  });

  it('scales with a custom spacing', () => {
    expect(orbZForSlot(0, 2, 1)).toBeCloseTo(-0.5, 6);
    expect(orbZForSlot(1, 2, 1)).toBeCloseTo(0.5, 6);
  });
});

describe('AE509 - layoutOrbsForTrip', () => {
  it('returns an empty array when there are no days', () => {
    expect(layoutOrbsForTrip([])).toEqual([]);
  });

  it('returns an empty array when every day has no items', () => {
    expect(layoutOrbsForTrip([DAY()])).toEqual([]);
  });

  it('emits one OrbLayout per item, ordered within a day by position', () => {
    const day = DAY({
      items: [ITEM({ id: 'b', position: 2 }), ITEM({ id: 'a', position: 1 })],
    });
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs.map((o) => o.id)).toEqual(['a', 'b']);
    expect(orbs.map((o) => o.itemPosition)).toEqual([1, 2]);
  });

  it('keeps y=0 for every orb (AE378 stays on the y=0 plane)', () => {
    const day = DAY({ items: [ITEM({ id: 'a' }), ITEM({ id: 'b', position: 1 })] });
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs.every((o) => o.y === 0)).toBe(true);
  });

  it('passes the placeId through (including the null case)', () => {
    const day = DAY({
      items: [
        ITEM({ id: 'has-place', placeId: 'p-9' }),
        ITEM({ id: 'no-place', position: 1, placeId: null }),
      ],
    });
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs[0]!.placeId).toBe('p-9');
    expect(orbs[1]!.placeId).toBeNull();
  });

  it('places a single-item single-day trip at the world origin', () => {
    const orbs = layoutOrbsForTrip([DAY({ items: [ITEM()] })]);
    expect(orbs).toHaveLength(1);
    expect(orbs[0]!.x).toBe(0);
    expect(orbs[0]!.z).toBe(0);
  });

  it('spreads two days across the timeline (left edge + right edge)', () => {
    const orbs = layoutOrbsForTrip([
      DAY({ id: 'd0', dayIndex: 0, items: [ITEM({ id: 'a' })] }),
      DAY({ id: 'd1', dayIndex: 1, items: [ITEM({ id: 'b' })] }),
    ]);
    expect(orbs[0]!.x).toBe(-8);
    expect(orbs[1]!.x).toBe(8);
  });

  it('clamps items past maxOrbsPerSlot onto the last visible slot', () => {
    const config: AtlasLayoutConfig = { axisLength: 16, orbZSpacing: 0.45, maxOrbsPerSlot: 2 };
    const day = DAY({
      items: [
        ITEM({ id: 'a', position: 0 }),
        ITEM({ id: 'b', position: 1 }),
        ITEM({ id: 'c', position: 2 }),
        ITEM({ id: 'd', position: 3 }),
      ],
    });
    const orbs = layoutOrbsForTrip([day], config);
    // totalSlots clamps to maxOrbsPerSlot=2 -> z-slots are [-0.225, 0.225]
    expect(orbs[0]!.z).toBeCloseTo(-0.225, 6);
    expect(orbs[1]!.z).toBeCloseTo(0.225, 6);
    // overflow items collapse onto the last slot
    expect(orbs[2]!.z).toBeCloseTo(0.225, 6);
    expect(orbs[3]!.z).toBeCloseTo(0.225, 6);
  });

  it('uses DEFAULT_ATLAS_LAYOUT when no config arg is supplied', () => {
    const day = DAY({ items: [ITEM({ id: 'a' }), ITEM({ id: 'b', position: 1 })] });
    const orbs = layoutOrbsForTrip([day]);
    expect(orbs[0]!.z).toBeCloseTo(-0.225, 6);
    expect(orbs[1]!.z).toBeCloseTo(0.225, 6);
  });

  it('preserves dayIndex on each emitted orb', () => {
    const orbs = layoutOrbsForTrip([
      DAY({ id: 'd0', dayIndex: 0, items: [ITEM({ id: 'a' })] }),
      DAY({ id: 'd1', dayIndex: 1, items: [ITEM({ id: 'b' })] }),
    ]);
    expect(orbs.map((o) => o.dayIndex)).toEqual([0, 1]);
  });

  it('does not mutate the input items array (sort works on a copy)', () => {
    const items = [ITEM({ id: 'b', position: 2 }), ITEM({ id: 'a', position: 1 })];
    const day = DAY({ items });
    layoutOrbsForTrip([day]);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('AE509 - layoutDayMarkers', () => {
  it('returns an empty array for zero days', () => {
    expect(layoutDayMarkers([])).toEqual([]);
  });

  it('emits exactly one marker per day, preserving date + dayIndex', () => {
    const markers = layoutDayMarkers([
      DAY({ id: 'd0', dayIndex: 0, date: '2026-06-01' }),
      DAY({ id: 'd1', dayIndex: 1, date: '2026-06-02' }),
      DAY({ id: 'd2', dayIndex: 2, date: '2026-06-03' }),
    ]);
    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.dayIndex)).toEqual([0, 1, 2]);
    expect(markers.map((m) => m.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('aligns each marker x with dayPositionOnAxis', () => {
    const markers = layoutDayMarkers([
      DAY({ id: 'd0', dayIndex: 0 }),
      DAY({ id: 'd1', dayIndex: 1 }),
    ]);
    expect(markers[0]!.x).toBe(-8);
    expect(markers[1]!.x).toBe(8);
  });

  it('places a single-day marker at x=0', () => {
    const markers = layoutDayMarkers([DAY({ dayIndex: 0 })]);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.x).toBe(0);
  });

  it('honours a custom axisLength via config arg', () => {
    const config: AtlasLayoutConfig = { axisLength: 20, orbZSpacing: 0.45, maxOrbsPerSlot: 6 };
    const markers = layoutDayMarkers(
      [DAY({ id: 'd0', dayIndex: 0 }), DAY({ id: 'd1', dayIndex: 1 })],
      config,
    );
    expect(markers[0]!.x).toBe(-10);
    expect(markers[1]!.x).toBe(10);
  });
});

describe('AE509 - orbSizeForItem', () => {
  it('returns the fixed AE378 default of 0.18 world units', () => {
    expect(orbSizeForItem(ITEM())).toBe(0.18);
  });

  it('returns the same size regardless of item content', () => {
    expect(orbSizeForItem(ITEM({ id: 'x', position: 9, placeId: null }))).toBe(0.18);
  });
});

describe('AE509 - orbColorForItem', () => {
  it('passes the themeAccent through unchanged', () => {
    expect(orbColorForItem(ITEM(), '#bf6b3a')).toBe('#bf6b3a');
  });

  it('accepts any non-empty string accent (AE378 themes them all to ochre.glow)', () => {
    expect(orbColorForItem(ITEM(), 'rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
  });

  it('returns an empty string when the accent is empty (no fallback)', () => {
    expect(orbColorForItem(ITEM(), '')).toBe('');
  });
});
