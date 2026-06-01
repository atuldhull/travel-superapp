/**
 * AE499 â€” canvas-shared own behavioural spec for `lumen-museum`.
 *
 * Pins DEFAULT_MUSEUM_ARC's frozen tunables, museumArcPositions' empty-Map
 * guards (null focus + missing focused id), the chronological X sort with
 * id tie-break, the angle math at the arc endpoints + centre, vertical
 * compression boundaries (0 = flat, 1 = preserved), depthOffset's -Z
 * shove, and resolveMuseumTarget's three-branch fallback table.
 */
import { DEFAULT_MUSEUM_ARC, museumArcPositions, resolveMuseumTarget } from '../src';
import type { LumenPlaneLayout, MuseumArcConfig } from '../src';

const PLANE = (id: string, x: number, y: number, z: number = 0): LumenPlaneLayout => ({
  id,
  position: [x, y, z],
  size: 1,
  url: null,
});

describe('AE499 â€” DEFAULT_MUSEUM_ARC tunables', () => {
  it('exposes a radius around 4.5 world units', () => {
    expect(DEFAULT_MUSEUM_ARC.radius).toBe(4.5);
  });

  it('uses a half-circle (pi radians) arc span by default', () => {
    expect(DEFAULT_MUSEUM_ARC.arcSpanRadians).toBe(Math.PI);
  });

  it('starts with zero depth offset so the arc centre sits at the focused plane', () => {
    expect(DEFAULT_MUSEUM_ARC.depthOffset).toBe(0);
  });

  it('compresses the rating axis to 0.35 by default (hint without scatter)', () => {
    expect(DEFAULT_MUSEUM_ARC.verticalCompression).toBe(0.35);
  });

  it('is frozen so callers cannot mutate the shared default', () => {
    expect(Object.isFrozen(DEFAULT_MUSEUM_ARC)).toBe(true);
  });
});

describe('AE499 â€” museumArcPositions guards', () => {
  it('returns an empty Map when focusedId is null', () => {
    const planes = [PLANE('a', 0, 0), PLANE('b', 1, 0)];
    const map = museumArcPositions(planes, null);
    expect(map.size).toBe(0);
  });

  it('returns an empty Map when focusedId is not found in the planes array', () => {
    const planes = [PLANE('a', 0, 0), PLANE('b', 1, 0)];
    const map = museumArcPositions(planes, 'ghost');
    expect(map.size).toBe(0);
  });

  it('returns a Map with just the focused entry when no other planes exist', () => {
    const planes = [PLANE('solo', 2, 3, 4)];
    const map = museumArcPositions(planes, 'solo');
    expect(map.size).toBe(1);
    expect(map.get('solo')).toEqual([2, 3, 4]);
  });

  it('always records the focused plane at its own cloud position', () => {
    const planes = [PLANE('focus', 7, -1, 2), PLANE('other', 0, 0, 0)];
    const map = museumArcPositions(planes, 'focus');
    expect(map.get('focus')).toEqual([7, -1, 2]);
  });
});

describe('AE499 â€” museumArcPositions arc math', () => {
  it('puts a single other plane at angle=0 (directly behind focused along -Z)', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('only-other', 5, 0, 0)];
    const map = museumArcPositions(planes, 'focus');
    const pos = map.get('only-other');
    expect(pos).toBeDefined();
    if (!pos) return;
    // sin(0)=0, cos(0)=1 -> x stays at focus, z = focus.z - radius.
    expect(pos[0]).toBeCloseTo(0, 10);
    expect(pos[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 10);
  });

  it('places the leftmost (smallest X) other plane at the -span/2 endpoint', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('early', -3, 0, 0), PLANE('late', 3, 0, 0)];
    const map = museumArcPositions(planes, 'focus');
    const early = map.get('early');
    expect(early).toBeDefined();
    if (!early) return;
    // half-circle: angle = -pi/2 -> sin = -1, cos = 0 -> x = -radius, z = focus.z.
    expect(early[0]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 10);
    expect(early[2]).toBeCloseTo(0, 10);
  });

  it('places the rightmost (largest X) other plane at the +span/2 endpoint', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('early', -3, 0, 0), PLANE('late', 3, 0, 0)];
    const map = museumArcPositions(planes, 'focus');
    const late = map.get('late');
    expect(late).toBeDefined();
    if (!late) return;
    expect(late[0]).toBeCloseTo(DEFAULT_MUSEUM_ARC.radius, 10);
    expect(late[2]).toBeCloseTo(0, 10);
  });

  it('breaks X-axis ties by id (smaller id first) so the order is stable', () => {
    const planes = [
      PLANE('focus', 0, 0, 0),
      PLANE('zeta', 1, 0, 0),
      PLANE('alpha', 1, 0, 0),
      PLANE('gamma', 5, 0, 0),
    ];
    const map = museumArcPositions(planes, 'focus');
    const alpha = map.get('alpha');
    const zeta = map.get('zeta');
    const gamma = map.get('gamma');
    expect(alpha).toBeDefined();
    expect(zeta).toBeDefined();
    expect(gamma).toBeDefined();
    if (!alpha || !zeta || !gamma) return;
    // alpha sorts before zeta, so alpha takes the leftmost slot.
    expect(alpha[0]).toBeLessThan(zeta[0]);
    expect(zeta[0]).toBeLessThan(gamma[0]);
  });

  it('offsets the focused position into the arc (origin not assumed)', () => {
    const planes = [PLANE('focus', 10, 5, -2), PLANE('only', 99, 5, -2)];
    const map = museumArcPositions(planes, 'focus');
    const pos = map.get('only');
    expect(pos).toBeDefined();
    if (!pos) return;
    expect(pos[0]).toBeCloseTo(10, 10);
    expect(pos[2]).toBeCloseTo(-2 - DEFAULT_MUSEUM_ARC.radius, 10);
  });
});

describe('AE499 â€” museumArcPositions vertical compression', () => {
  it('flattens Y completely when verticalCompression = 0', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('high', 5, 3, 0)];
    const config: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, verticalCompression: 0 };
    const map = museumArcPositions(planes, 'focus', config);
    const pos = map.get('high');
    expect(pos).toBeDefined();
    if (!pos) return;
    expect(pos[1]).toBeCloseTo(0, 10);
  });

  it('preserves the rating axis exactly when verticalCompression = 1', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('high', 5, 3, 0)];
    const config: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, verticalCompression: 1 };
    const map = museumArcPositions(planes, 'focus', config);
    const pos = map.get('high');
    expect(pos).toBeDefined();
    if (!pos) return;
    expect(pos[1]).toBeCloseTo(3, 10);
  });

  it('blends fractionally at the default 0.35 (hint without scatter)', () => {
    const planes = [PLANE('focus', 0, 2, 0), PLANE('other', 5, 4, 0)];
    const map = museumArcPositions(planes, 'focus');
    const pos = map.get('other');
    expect(pos).toBeDefined();
    if (!pos) return;
    // y = fy + (py - fy) * 0.35 = 2 + (4 - 2) * 0.35 = 2.7
    expect(pos[1]).toBeCloseTo(2.7, 10);
  });
});

describe('AE499 â€” museumArcPositions depthOffset', () => {
  it('pushes the arc further behind focused along -Z when depthOffset > 0', () => {
    const planes = [PLANE('focus', 0, 0, 0), PLANE('only', 5, 0, 0)];
    const config: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, depthOffset: 2 };
    const map = museumArcPositions(planes, 'focus', config);
    const pos = map.get('only');
    expect(pos).toBeDefined();
    if (!pos) return;
    // z = fz - depth - cos(0)*r = 0 - 2 - 4.5 = -6.5
    expect(pos[2]).toBeCloseTo(-6.5, 10);
  });
});

describe('AE499 â€” resolveMuseumTarget fallback table', () => {
  it('returns the plane its own cloud position when focusedId is null', () => {
    const plane = PLANE('a', 1, 2, 3);
    const planes = [plane, PLANE('b', 4, 5, 6)];
    expect(resolveMuseumTarget(plane, null, planes)).toEqual([1, 2, 3]);
  });

  it('returns the arc-resolved target for a non-focused plane when focus is set', () => {
    const focus = PLANE('focus', 0, 0, 0);
    const other = PLANE('other', 5, 0, 0);
    const planes = [focus, other];
    const target = resolveMuseumTarget(other, 'focus', planes);
    expect(target[0]).toBeCloseTo(0, 10);
    expect(target[2]).toBeCloseTo(-DEFAULT_MUSEUM_ARC.radius, 10);
  });

  it('returns the focused plane its own position when it is the one focused', () => {
    const focus = PLANE('focus', 7, 8, 9);
    const planes = [focus, PLANE('other', 0, 0, 0)];
    expect(resolveMuseumTarget(focus, 'focus', planes)).toEqual([7, 8, 9]);
  });

  it('falls back to the plane its own position when focusedId is not in planes', () => {
    const plane = PLANE('a', 1, 2, 3);
    const planes = [plane];
    // The Map will be empty because ghost is not in planes -> fallback.
    expect(resolveMuseumTarget(plane, 'ghost', planes)).toEqual([1, 2, 3]);
  });

  it('respects a caller-supplied config override', () => {
    const focus = PLANE('focus', 0, 0, 0);
    const other = PLANE('other', 5, 0, 0);
    const planes = [focus, other];
    const config: MuseumArcConfig = { ...DEFAULT_MUSEUM_ARC, radius: 10 };
    const target = resolveMuseumTarget(other, 'focus', planes, config);
    expect(target[2]).toBeCloseTo(-10, 10);
  });
});
