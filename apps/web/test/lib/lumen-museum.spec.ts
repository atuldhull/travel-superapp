/** Vitest specs for AE409 Lumen museum-arc helpers. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MUSEUM_ARC,
  museumArcPositions,
  resolveMuseumTarget,
  type MuseumArcConfig,
} from '../../src/components/aether/phase2/lumen-museum';
import type { LumenPlaneLayout } from '../../src/components/aether/phase2/lumen-cloud';

function plane(id: string, position: [number, number, number]): LumenPlaneLayout {
  return { id, position, size: 1.6, url: null };
}

describe('DEFAULT_MUSEUM_ARC (pure)', () => {
  it('frozen with sensible defaults', () => {
    expect(DEFAULT_MUSEUM_ARC.radius).toBe(4.5);
    expect(DEFAULT_MUSEUM_ARC.arcSpanRadians).toBe(Math.PI);
    expect(DEFAULT_MUSEUM_ARC.depthOffset).toBe(0);
    expect(DEFAULT_MUSEUM_ARC.verticalCompression).toBeGreaterThan(0);
    expect(DEFAULT_MUSEUM_ARC.verticalCompression).toBeLessThan(1);
  });
});

describe('museumArcPositions (pure)', () => {
  const planes = [
    plane('a', [-5, 2, 0]),
    plane('b', [0, 0, 0]), // focused
    plane('c', [3, -1, 0]),
    plane('d', [5, 3, 0]),
  ];

  it('null focus → empty map', () => {
    expect(museumArcPositions(planes, null).size).toBe(0);
  });

  it('unknown focus → empty map', () => {
    expect(museumArcPositions(planes, 'missing').size).toBe(0);
  });

  it('empty planes + any focus → empty map', () => {
    expect(museumArcPositions([], 'b').size).toBe(0);
  });

  it('focused plane keeps its own position', () => {
    const out = museumArcPositions(planes, 'b');
    expect(out.get('b')).toEqual([0, 0, 0]);
  });

  it('all planes (focused + others) are mapped', () => {
    const out = museumArcPositions(planes, 'b');
    expect(out.size).toBe(planes.length);
    for (const p of planes) {
      expect(out.has(p.id)).toBe(true);
    }
  });

  it('others sit on a sphere of radius around the focused plane', () => {
    const out = museumArcPositions(planes, 'b');
    const focusedPos = [0, 0, 0];
    for (const id of ['a', 'c', 'd']) {
      const pos = out.get(id);
      expect(pos).not.toBeUndefined();
      if (pos === undefined) continue;
      const dx = pos[0] - focusedPos[0];
      const dz = pos[2] - focusedPos[2];
      const r = Math.sqrt(dx * dx + dz * dz);
      expect(r).toBeCloseTo(DEFAULT_MUSEUM_ARC.radius, 5);
    }
  });

  it('arc orders left → right by current X (time axis)', () => {
    // Time-sorted others: a (-5), c (3), d (5). Their arc X should
    // increase across them when span = π.
    const out = museumArcPositions(planes, 'b');
    const xa = out.get('a')?.[0] ?? Number.NaN;
    const xc = out.get('c')?.[0] ?? Number.NaN;
    const xd = out.get('d')?.[0] ?? Number.NaN;
    expect(xa).toBeLessThan(xc);
    expect(xc).toBeLessThan(xd);
  });

  it('center-of-arc plane sits directly behind focused (angle=0)', () => {
    // With 3 others sorted [a, c, d], the middle one (c) lands at t=0.5
    // → angle 0 → x = focused.x, z = focused.z - radius.
    const out = museumArcPositions(planes, 'b');
    const pos = out.get('c');
    expect(pos).not.toBeUndefined();
    if (pos === undefined) return;
    expect(pos[0]).toBeCloseTo(0, 5);
    expect(pos[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 5);
  });

  it('arc endpoints sit at focused.z (cos(±π/2) = 0)', () => {
    // a and d (endpoints) should sit at the focused z.
    const out = museumArcPositions(planes, 'b');
    expect(out.get('a')?.[2]).toBeCloseTo(0, 5);
    expect(out.get('d')?.[2]).toBeCloseTo(0, 5);
  });

  it('single other plane lands at arc centre (t=0.5)', () => {
    const out = museumArcPositions([plane('focus', [1, 1, 1]), plane('only', [2, 2, 2])], 'focus');
    const pos = out.get('only');
    expect(pos).not.toBeUndefined();
    if (pos === undefined) return;
    // angle 0 → x = focused.x, z = focused.z - radius
    expect(pos[0]).toBeCloseTo(1, 5);
    expect(pos[2]).toBeCloseTo(1 - DEFAULT_MUSEUM_ARC.radius, 5);
  });

  it('no others → only focused plane in the map', () => {
    const out = museumArcPositions([plane('solo', [4, 4, 4])], 'solo');
    expect(out.size).toBe(1);
    expect(out.get('solo')).toEqual([4, 4, 4]);
  });

  it('vertical compression compresses original Y offset', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('high', [0, 6, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, verticalCompression: 0.5 };
    const out = museumArcPositions(sample, 'focus', cfg);
    // 'high' had Y=6, compressed to 6 * 0.5 = 3.
    expect(out.get('high')?.[1]).toBeCloseTo(3, 5);
  });

  it('verticalCompression 0 → flat arc at focused y', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('high', [0, 6, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, verticalCompression: 0 };
    const out = museumArcPositions(sample, 'focus', cfg);
    expect(out.get('high')?.[1]).toBeCloseTo(0, 5);
  });

  it('verticalCompression 1 → preserves original Y delta', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('high', [0, 6, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, verticalCompression: 1 };
    const out = museumArcPositions(sample, 'focus', cfg);
    expect(out.get('high')?.[1]).toBeCloseTo(6, 5);
  });

  it('custom radius scales the arc', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('only', [1, 0, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, radius: 10 };
    const out = museumArcPositions(sample, 'focus', cfg);
    expect(out.get('only')?.[2]).toBeCloseTo(-10, 5);
  });

  it('depthOffset pushes the arc centre further back', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('only', [1, 0, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, depthOffset: 2 };
    const out = museumArcPositions(sample, 'focus', cfg);
    // arc centre at -depthOffset; t=0.5 → angle 0 → z = focused.z - depth - radius
    expect(out.get('only')?.[2]).toBeCloseTo(-2 - DEFAULT_MUSEUM_ARC.radius, 5);
  });

  it('tie-break on equal X uses id ascending', () => {
    const sample = [
      plane('focus', [0, 0, 0]),
      plane('b-tied', [2, 0, 0]),
      plane('a-tied', [2, 0, 0]),
    ];
    // With 2 tied others, 'a-tied' should sort first (idx 0, t=0)
    // and end up to the left of the arc (angle = -π/2 → x = -radius).
    const out = museumArcPositions(sample, 'focus');
    expect(out.get('a-tied')?.[0]).toBeLessThan(out.get('b-tied')?.[0] ?? Number.POSITIVE_INFINITY);
  });

  it('honours arcSpanRadians for narrower arcs', () => {
    const sample = [plane('focus', [0, 0, 0]), plane('left', [0, 0, 0]), plane('right', [1, 0, 0])];
    const cfg: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, arcSpanRadians: Math.PI / 2 };
    const out = museumArcPositions(sample, 'focus', cfg);
    // Span π/2 with 2 others (t=0, 1) → angles -π/4 and +π/4
    // x = radius * sin(±π/4) ≈ ±radius * 0.7071
    const expectedX = DEFAULT_MUSEUM_ARC.radius * Math.SQRT1_2;
    expect(Math.abs(out.get('left')?.[0] ?? 0)).toBeCloseTo(expectedX, 4);
    expect(Math.abs(out.get('right')?.[0] ?? 0)).toBeCloseTo(expectedX, 4);
  });
});

describe('resolveMuseumTarget (pure)', () => {
  const planes = [plane('focus', [0, 0, 0]), plane('other', [3, 0, 0])];

  it('null focus → plane returns its own position', () => {
    expect(resolveMuseumTarget(planes[1], null, planes)).toEqual([3, 0, 0]);
  });

  it('unknown focus → plane returns its own position (safe fallback)', () => {
    expect(resolveMuseumTarget(planes[1], 'missing', planes)).toEqual([3, 0, 0]);
  });

  it('focused plane → its own position (centre of the arc)', () => {
    expect(resolveMuseumTarget(planes[0], 'focus', planes)).toEqual([0, 0, 0]);
  });

  it('other plane → arc position (different from cloud position)', () => {
    const target = resolveMuseumTarget(planes[1], 'focus', planes);
    // Single other plane lands at angle 0 → (0, 0, -radius).
    expect(target[0]).toBeCloseTo(0, 5);
    expect(target[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 5);
  });

  it('plane not in list → returns its own position', () => {
    const orphan = plane('orphan', [9, 9, 9]);
    expect(resolveMuseumTarget(orphan, 'focus', planes)).toEqual([9, 9, 9]);
  });
});

describe('museumArcPositions (AE443 edge cases)', () => {
  function p(id: string, pos: readonly [number, number, number]) {
    return { id, position: pos, size: 1, url: null } as const;
  }
  it('single other plane sits at centre of arc (angle = 0)', () => {
    const planes = [p('focus', [0, 0, 0]), p('other', [5, 0, 0])];
    const map = museumArcPositions(planes, 'focus');
    const target = map.get('other')!;
    // angle = 0 → x ≈ fx, z ≈ fz - radius
    expect(target[0]).toBeCloseTo(0, 5);
    expect(target[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 5);
  });
  it('two other planes flank focus left + right', () => {
    const planes = [p('focus', [0, 0, 0]), p('left', [-3, 0, 0]), p('right', [3, 0, 0])];
    const map = museumArcPositions(planes, 'focus');
    const left = map.get('left')!;
    const right = map.get('right')!;
    expect(left[0]).toBeLessThan(0);
    expect(right[0]).toBeGreaterThan(0);
  });
  it('all planes on same X tie-break by id (stable)', () => {
    const planes = [p('focus', [0, 0, 0]), p('beta', [2, 0, 0]), p('alpha', [2, 0, 0])];
    const map1 = museumArcPositions(planes, 'focus');
    const map2 = museumArcPositions(planes, 'focus');
    expect(map1.get('alpha')).toEqual(map2.get('alpha'));
    expect(map1.get('beta')).toEqual(map2.get('beta'));
  });
  it('vertical compression with extreme rating axis stays bounded', () => {
    const planes = [p('focus', [0, 0, 0]), p('high', [3, 100, 0])];
    const map = museumArcPositions(planes, 'focus');
    const t = map.get('high')!;
    // vert-comp default 0.35 → y ≈ 35
    expect(t[1]).toBeCloseTo(35, 0);
  });
  it('config override flattens arc radius', () => {
    const planes = [p('focus', [0, 0, 0]), p('other', [3, 0, 0])];
    const map = museumArcPositions(planes, 'focus', {
      ...DEFAULT_MUSEUM_ARC,
      radius: 1.5,
    });
    const t = map.get('other')!;
    expect(t[2]).toBeCloseTo(-1.5, 5);
  });
  it('depthOffset pushes the arc further back along -Z', () => {
    const planes = [p('focus', [0, 0, 0]), p('other', [3, 0, 0])];
    const map = museumArcPositions(planes, 'focus', {
      ...DEFAULT_MUSEUM_ARC,
      depthOffset: 2,
    });
    const t = map.get('other')!;
    expect(t[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius - 2, 5);
  });
  it('focused plane present in result map at its own position', () => {
    const planes = [p('focus', [1, 2, 3]), p('other', [5, 0, 0])];
    const map = museumArcPositions(planes, 'focus');
    expect(map.get('focus')).toEqual([1, 2, 3]);
  });
  it('null focus → empty map', () => {
    const planes = [p('a', [0, 0, 0])];
    const map = museumArcPositions(planes, null);
    expect(map.size).toBe(0);
  });
  it('unknown focus id → empty map', () => {
    const planes = [p('a', [0, 0, 0])];
    const map = museumArcPositions(planes, 'never-existed');
    expect(map.size).toBe(0);
  });
});
