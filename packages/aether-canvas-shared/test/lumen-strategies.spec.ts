/**
 * AE508 â€” canvas-shared own behavioural spec for the AE410 Lumen
 * layout-strategy helpers.
 *
 * Covers:
 *   - LUMEN_LAYOUT_STRATEGIES tuple (order, length, frozen)
 *   - layoutStrategyLabel (all five branches)
 *   - layoutStrategyDescription (all five branches, distinguishing words)
 *   - layoutByGrid (empty / singleton / multi, sqrt-N cols, centred origin, z=0)
 *   - layoutBySpiral (empty / singleton / multi, golden-angle, radius scales)
 *   - layoutByWall (empty / multi, tight 70% packing, light z jitter)
 *   - layoutByMoodStub (delegates to time-cloud layout)
 *   - applyLayoutStrategy (every branch routes to its dedicated helper)
 *   - isStrategyImplemented (mood is the only non-implemented strategy)
 *
 * Imports only from the package barrel so the helpers stay shippable to any
 * consumer that re-exports `@app/aether-canvas-shared`.
 */

import {
  DEFAULT_LUMEN_LAYOUT,
  LUMEN_LAYOUT_STRATEGIES,
  applyLayoutStrategy,
  isStrategyImplemented,
  layoutByGrid,
  layoutByMoodStub,
  layoutBySpiral,
  layoutByWall,
  layoutPhotoCloud,
  layoutStrategyDescription,
  layoutStrategyLabel,
  type LumenLayoutStrategy,
  type LumenPhotoLike,
} from '../src';

const PHOTO = (overrides: Partial<LumenPhotoLike> = {}): LumenPhotoLike => ({
  id: 'p-1',
  capturedAt: '2024-06-01T10:00:00Z',
  rating: 3,
  url: 'https://example.test/p-1.jpg',
  ...overrides,
});

const photoBatch = (n: number): LumenPhotoLike[] =>
  Array.from({ length: n }, (_, i) =>
    PHOTO({
      id: `p-${i}`,
      capturedAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
      rating: (i % 5) + 1,
      url: `https://example.test/p-${i}.jpg`,
    }),
  );

describe('AE508 - LUMEN_LAYOUT_STRATEGIES', () => {
  it('lists all five strategies in display order', () => {
    expect(LUMEN_LAYOUT_STRATEGIES).toEqual(['time', 'grid', 'spiral', 'wall', 'mood']);
  });

  it('is frozen so the arrange menu cannot accidentally mutate it', () => {
    expect(Object.isFrozen(LUMEN_LAYOUT_STRATEGIES)).toBe(true);
  });
});

describe('AE508 - layoutStrategyLabel', () => {
  it('returns Cloud for the time strategy', () => {
    expect(layoutStrategyLabel('time')).toBe('Cloud');
  });

  it('returns Grid for the grid strategy', () => {
    expect(layoutStrategyLabel('grid')).toBe('Grid');
  });

  it('returns Spiral for the spiral strategy', () => {
    expect(layoutStrategyLabel('spiral')).toBe('Spiral');
  });

  it('returns Wall for the wall strategy', () => {
    expect(layoutStrategyLabel('wall')).toBe('Wall');
  });

  it('returns Mood for the mood strategy', () => {
    expect(layoutStrategyLabel('mood')).toBe('Mood');
  });
});

describe('AE508 - layoutStrategyDescription', () => {
  it('mentions both axes for the time strategy', () => {
    expect(layoutStrategyDescription('time')).toMatch(/capture time/i);
    expect(layoutStrategyDescription('time')).toMatch(/rating/i);
  });

  it('mentions grid for the grid strategy', () => {
    expect(layoutStrategyDescription('grid')).toMatch(/grid/i);
  });

  it('mentions golden-angle for the spiral strategy', () => {
    expect(layoutStrategyDescription('spiral')).toMatch(/golden-angle/i);
  });

  it('mentions wall for the wall strategy', () => {
    expect(layoutStrategyDescription('wall')).toMatch(/wall/i);
  });

  it('flags that the mood strategy is a stub awaiting AI', () => {
    expect(layoutStrategyDescription('mood')).toMatch(/AI/i);
    expect(layoutStrategyDescription('mood')).toMatch(/cloud/i);
  });
});

describe('AE508 - layoutByGrid', () => {
  it('returns an empty array for an empty photo list', () => {
    expect(layoutByGrid([])).toEqual([]);
  });

  it('returns a singleton plane for a single photo at z=0', () => {
    const photos = [PHOTO({ id: 'solo' })];
    const out = layoutByGrid(photos);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('solo');
    expect(out[0].position[2]).toBe(0);
  });

  it('lays a 4-photo batch on a 2x2 grid (sqrt-N cols)', () => {
    const photos = photoBatch(4);
    const out = layoutByGrid(photos);
    expect(out).toHaveLength(4);
    // 4 photos -> cols = ceil(sqrt(4)) = 2 -> two distinct x coordinates
    const xs = new Set(out.map((p) => p.position[0]));
    expect(xs.size).toBe(2);
  });

  it('keeps every plane on z=0 (flat surface)', () => {
    const out = layoutByGrid(photoBatch(9));
    out.forEach((plane) => expect(plane.position[2]).toBe(0));
  });

  it('centres the grid around the origin (mean x and y stay near zero)', () => {
    const out = layoutByGrid(photoBatch(9));
    const meanX = out.reduce((s, p) => s + p.position[0], 0) / out.length;
    const meanY = out.reduce((s, p) => s + p.position[1], 0) / out.length;
    // 9 photos -> 3x3 grid; both means collapse exactly to 0.
    expect(Math.abs(meanX)).toBeLessThan(1e-9);
    expect(Math.abs(meanY)).toBeLessThan(1e-9);
  });

  it('uses the default config plane size when no config is supplied', () => {
    const out = layoutByGrid([PHOTO()]);
    expect(out[0].size).toBe(DEFAULT_LUMEN_LAYOUT.planeBaseSize);
  });

  it('forwards the photo url through to the layout', () => {
    const out = layoutByGrid([PHOTO({ url: 'https://cdn.test/x.jpg' })]);
    expect(out[0].url).toBe('https://cdn.test/x.jpg');
  });
});

describe('AE508 - layoutBySpiral', () => {
  it('returns an empty array for an empty photo list', () => {
    expect(layoutBySpiral([])).toEqual([]);
  });

  it('returns a singleton plane for a single photo at z=0', () => {
    const out = layoutBySpiral([PHOTO({ id: 'solo' })]);
    expect(out).toHaveLength(1);
    expect(out[0].position[2]).toBe(0);
  });

  it('places every plane within the configured max radius (disc bound)', () => {
    const out = layoutBySpiral(photoBatch(50));
    const maxRadius =
      Math.min(DEFAULT_LUMEN_LAYOUT.axisLengthX, DEFAULT_LUMEN_LAYOUT.axisLengthY) / 2;
    out.forEach((plane) => {
      const [x, y] = plane.position;
      const r = Math.sqrt(x * x + y * y);
      // sqrt((i + 0.5) / total) maxes out below 1, so radius stays under maxRadius.
      expect(r).toBeLessThanOrEqual(maxRadius + 1e-9);
    });
  });

  it('scales radius as sqrt(i) so later photos sit further out', () => {
    const out = layoutBySpiral(photoBatch(20));
    const r = (i: number) => {
      const [x, y] = out[i].position;
      return Math.sqrt(x * x + y * y);
    };
    expect(r(19)).toBeGreaterThan(r(0));
  });

  it('keeps every plane on z=0 (flat disc)', () => {
    const out = layoutBySpiral(photoBatch(7));
    out.forEach((plane) => expect(plane.position[2]).toBe(0));
  });

  it('preserves photo ids in input order', () => {
    const photos = photoBatch(5);
    const out = layoutBySpiral(photos);
    expect(out.map((p) => p.id)).toEqual(photos.map((p) => p.id));
  });
});

describe('AE508 - layoutByWall', () => {
  it('returns an empty array for an empty photo list', () => {
    expect(layoutByWall([])).toEqual([]);
  });

  it('packs a multi-photo batch tighter than the grid (70 percent of axis)', () => {
    const photos = photoBatch(9);
    const gridOut = layoutByGrid(photos);
    const wallOut = layoutByWall(photos);
    // Both lay 9 photos as 3 columns; the x distance between col0 and col1
    // on the wall should be strictly less than on the grid.
    const gridStep = Math.abs(gridOut[1].position[0] - gridOut[0].position[0]);
    const wallStep = Math.abs(wallOut[1].position[0] - wallOut[0].position[0]);
    expect(wallStep).toBeLessThan(gridStep);
  });

  it('applies a small z jitter (smaller than the time cloud jitter)', () => {
    const out = layoutByWall(photoBatch(12));
    const zs = out.map((p) => p.position[2]);
    // At least one photo has non-zero z (jitter active).
    expect(zs.some((z) => z !== 0)).toBe(true);
    // All z values stay well within the scaled-down jitter range.
    const maxAbsZ = Math.max(...zs.map(Math.abs));
    expect(maxAbsZ).toBeLessThan(DEFAULT_LUMEN_LAYOUT.jitterZ);
  });

  it('centres the wall around the origin on the x axis', () => {
    const out = layoutByWall(photoBatch(9));
    const meanX = out.reduce((s, p) => s + p.position[0], 0) / out.length;
    expect(Math.abs(meanX)).toBeLessThan(1e-9);
  });

  it('preserves the photo url on each plane', () => {
    const out = layoutByWall([PHOTO({ url: 'https://cdn.test/wall.jpg' })]);
    expect(out[0].url).toBe('https://cdn.test/wall.jpg');
  });
});

describe('AE508 - layoutByMoodStub', () => {
  it('delegates to the time-cloud layout (same length and ids)', () => {
    const photos = photoBatch(6);
    const stubOut = layoutByMoodStub(photos);
    const cloudOut = layoutPhotoCloud(photos);
    expect(stubOut).toEqual(cloudOut);
  });

  it('returns an empty array for an empty photo list', () => {
    expect(layoutByMoodStub([])).toEqual([]);
  });
});

describe('AE508 - applyLayoutStrategy', () => {
  const photos = photoBatch(8);

  it('routes time to the time-cloud layout', () => {
    expect(applyLayoutStrategy('time', photos)).toEqual(layoutPhotoCloud(photos));
  });

  it('routes grid to layoutByGrid', () => {
    expect(applyLayoutStrategy('grid', photos)).toEqual(layoutByGrid(photos));
  });

  it('routes spiral to layoutBySpiral', () => {
    expect(applyLayoutStrategy('spiral', photos)).toEqual(layoutBySpiral(photos));
  });

  it('routes wall to layoutByWall', () => {
    expect(applyLayoutStrategy('wall', photos)).toEqual(layoutByWall(photos));
  });

  it('routes mood to the stub (mirrors time-cloud for now)', () => {
    expect(applyLayoutStrategy('mood', photos)).toEqual(layoutByMoodStub(photos));
  });

  it('returns an empty array for an empty photo list on every strategy', () => {
    (['time', 'grid', 'spiral', 'wall', 'mood'] as const).forEach((s) => {
      expect(applyLayoutStrategy(s, [])).toEqual([]);
    });
  });

  it('honours the default config when none is supplied', () => {
    // Default-config call should match an explicit default-config call.
    expect(applyLayoutStrategy('grid', photos)).toEqual(
      applyLayoutStrategy('grid', photos, DEFAULT_LUMEN_LAYOUT),
    );
  });
});

describe('AE508 - isStrategyImplemented', () => {
  it('treats time as implemented', () => {
    expect(isStrategyImplemented('time')).toBe(true);
  });

  it('treats grid as implemented', () => {
    expect(isStrategyImplemented('grid')).toBe(true);
  });

  it('treats spiral as implemented', () => {
    expect(isStrategyImplemented('spiral')).toBe(true);
  });

  it('treats wall as implemented', () => {
    expect(isStrategyImplemented('wall')).toBe(true);
  });

  it('treats mood as not yet implemented (awaiting CLIP backend)', () => {
    expect(isStrategyImplemented('mood')).toBe(false);
  });

  it('marks exactly one strategy in the menu as pending backend', () => {
    const pending = LUMEN_LAYOUT_STRATEGIES.filter(
      (s: LumenLayoutStrategy) => !isStrategyImplemented(s),
    );
    expect(pending).toEqual(['mood']);
  });
});
