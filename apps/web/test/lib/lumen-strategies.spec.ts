/** Vitest specs for AE410 Lumen layout strategy helpers. */
import { describe, expect, it } from 'vitest';
import {
  LUMEN_LAYOUT_STRATEGIES,
  applyLayoutStrategy,
  isStrategyImplemented,
  layoutByGrid,
  layoutByMoodStub,
  layoutBySpiral,
  layoutByWall,
  layoutStrategyDescription,
  layoutStrategyLabel,
  type LumenLayoutStrategy,
} from '../../src/components/aether/phase2/lumen-strategies';
import {
  DEFAULT_LUMEN_LAYOUT,
  type LumenPhotoLike,
} from '../../src/components/aether/phase2/lumen-cloud';

function photo(id: string, position: number): LumenPhotoLike {
  return {
    id,
    capturedAt: new Date(Date.UTC(2026, 0, 1) + position * 60_000).toISOString(),
    rating: position,
    url: null,
  };
}

const TEN = Array.from({ length: 10 }, (_, i) => photo(`p${i}`, i));
const ONE = [photo('only', 0)];
const EMPTY: ReadonlyArray<LumenPhotoLike> = [];

describe('LUMEN_LAYOUT_STRATEGIES (pure)', () => {
  it('enumerates all 5 strategies in stable order', () => {
    expect(LUMEN_LAYOUT_STRATEGIES).toEqual(['time', 'grid', 'spiral', 'wall', 'mood']);
  });
});

describe('layoutStrategyLabel + description (pure)', () => {
  it('every strategy has a unique non-empty label', () => {
    const labels = new Set<string>();
    for (const s of LUMEN_LAYOUT_STRATEGIES) {
      const l = layoutStrategyLabel(s);
      expect(l.length).toBeGreaterThan(0);
      labels.add(l);
    }
    expect(labels.size).toBe(LUMEN_LAYOUT_STRATEGIES.length);
  });
  it('every strategy has a description', () => {
    for (const s of LUMEN_LAYOUT_STRATEGIES) {
      expect(layoutStrategyDescription(s).length).toBeGreaterThan(10);
    }
  });
  it('mood description names the stub honestly', () => {
    expect(layoutStrategyDescription('mood').toLowerCase()).toContain('later');
  });
});

describe('isStrategyImplemented (pure)', () => {
  it('mood is unimplemented; the rest are implemented', () => {
    expect(isStrategyImplemented('mood')).toBe(false);
    for (const s of ['time', 'grid', 'spiral', 'wall'] as LumenLayoutStrategy[]) {
      expect(isStrategyImplemented(s)).toBe(true);
    }
  });
});

describe('layoutByGrid (pure)', () => {
  it('empty photos → empty layout', () => {
    expect(layoutByGrid(EMPTY)).toEqual([]);
  });
  it('single photo → centred at origin (single cell)', () => {
    const out = layoutByGrid(ONE);
    expect(out).toHaveLength(1);
    expect(out[0].position[2]).toBe(0);
  });
  it('preserves order + ids', () => {
    const out = layoutByGrid(TEN);
    expect(out.map((p) => p.id)).toEqual(TEN.map((p) => p.id));
  });
  it('all planes sit on z=0 (flat surface)', () => {
    for (const p of layoutByGrid(TEN)) expect(p.position[2]).toBe(0);
  });
  it('lays out roughly sqrt-N rows × sqrt-N cols', () => {
    const out = layoutByGrid(TEN);
    const uniqueX = new Set(out.map((p) => p.position[0]));
    const uniqueY = new Set(out.map((p) => p.position[1]));
    // ceil(sqrt(10)) = 4 columns → 3 rows for 10 items.
    expect(uniqueX.size).toBe(4);
    expect(uniqueY.size).toBe(3);
  });
  it('plane size matches config default', () => {
    const out = layoutByGrid(ONE);
    expect(out[0].size).toBe(DEFAULT_LUMEN_LAYOUT.planeBaseSize);
  });
  it('preserves url passthrough', () => {
    const withUrl: LumenPhotoLike[] = [
      { id: 'u', capturedAt: null, rating: null, url: 'https://x' },
    ];
    expect(layoutByGrid(withUrl)[0].url).toBe('https://x');
  });
});

describe('layoutBySpiral (pure)', () => {
  it('empty photos → empty layout', () => {
    expect(layoutBySpiral(EMPTY)).toEqual([]);
  });
  it('all planes sit on z=0', () => {
    for (const p of layoutBySpiral(TEN)) expect(p.position[2]).toBe(0);
  });
  it('order preserved', () => {
    expect(layoutBySpiral(TEN).map((p) => p.id)).toEqual(TEN.map((p) => p.id));
  });
  it('successive radii are non-decreasing (phyllotaxis density)', () => {
    const out = layoutBySpiral(TEN);
    let lastR = -1;
    for (const p of out) {
      const r = Math.sqrt(p.position[0] * p.position[0] + p.position[1] * p.position[1]);
      expect(r).toBeGreaterThanOrEqual(lastR);
      lastR = r;
    }
  });
  it('outermost photo lands at or under the visual cap', () => {
    const out = layoutBySpiral(TEN);
    const maxR = Math.min(DEFAULT_LUMEN_LAYOUT.axisLengthX, DEFAULT_LUMEN_LAYOUT.axisLengthY) / 2;
    for (const p of out) {
      const r = Math.sqrt(p.position[0] * p.position[0] + p.position[1] * p.position[1]);
      expect(r).toBeLessThanOrEqual(maxR + 1e-9);
    }
  });
});

describe('layoutByWall (pure)', () => {
  it('empty photos → empty layout', () => {
    expect(layoutByWall(EMPTY)).toEqual([]);
  });
  it('z has slight jitter but stays bounded', () => {
    const cap = DEFAULT_LUMEN_LAYOUT.jitterZ * 0.25;
    for (const p of layoutByWall(TEN)) {
      expect(Math.abs(p.position[2])).toBeLessThanOrEqual(cap);
    }
  });
  it('tighter than grid (smaller x range for same N)', () => {
    const grid = layoutByGrid(TEN);
    const wall = layoutByWall(TEN);
    const gx =
      Math.max(...grid.map((p) => p.position[0])) - Math.min(...grid.map((p) => p.position[0]));
    const wx =
      Math.max(...wall.map((p) => p.position[0])) - Math.min(...wall.map((p) => p.position[0]));
    expect(wx).toBeLessThan(gx);
  });
  it('order + ids preserved', () => {
    expect(layoutByWall(TEN).map((p) => p.id)).toEqual(TEN.map((p) => p.id));
  });
});

describe('layoutByMoodStub (pure)', () => {
  it('falls back to time-cloud layout', () => {
    const stub = layoutByMoodStub(TEN);
    expect(stub).toHaveLength(TEN.length);
    expect(stub.map((p) => p.id)).toEqual(TEN.map((p) => p.id));
  });
});

describe('applyLayoutStrategy (pure)', () => {
  it("'time' dispatches to layoutPhotoCloud (3D cloud, Y varies)", () => {
    const out = applyLayoutStrategy('time', TEN);
    const ys = new Set(out.map((p) => p.position[1]));
    expect(ys.size).toBeGreaterThan(1);
  });
  it("'grid' dispatches to layoutByGrid (z=0 for all)", () => {
    const out = applyLayoutStrategy('grid', TEN);
    for (const p of out) expect(p.position[2]).toBe(0);
  });
  it("'spiral' dispatches to layoutBySpiral (radius non-decreasing)", () => {
    const out = applyLayoutStrategy('spiral', TEN);
    let lastR = -1;
    for (const p of out) {
      const r = Math.sqrt(p.position[0] ** 2 + p.position[1] ** 2);
      expect(r).toBeGreaterThanOrEqual(lastR);
      lastR = r;
    }
  });
  it("'wall' dispatches to layoutByWall (tight z jitter)", () => {
    const cap = DEFAULT_LUMEN_LAYOUT.jitterZ * 0.25;
    const out = applyLayoutStrategy('wall', TEN);
    for (const p of out) expect(Math.abs(p.position[2])).toBeLessThanOrEqual(cap);
  });
  it("'mood' mirrors 'time' (stub until CLIP)", () => {
    const a = applyLayoutStrategy('mood', TEN);
    const b = applyLayoutStrategy('time', TEN);
    expect(a).toEqual(b);
  });
  it('empty photos → empty for every strategy', () => {
    for (const s of LUMEN_LAYOUT_STRATEGIES) {
      expect(applyLayoutStrategy(s, EMPTY)).toEqual([]);
    }
  });
});
