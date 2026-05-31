/** AE375 — ParticleBurst pure-helper specs (`burstOffset`).
 *  The <ParticleBurst/> component itself isn't tested here — it requires an
 *  R3F context. */
import { __testing, burstOffset } from '../src/particle-burst';

const RADIUS = 6;

describe('burstOffset — idle mode', () => {
  it('positions every particle at the bounds', () => {
    for (let i = 0; i < 50; i += 1) {
      const [x, y, z] = burstOffset(i, 'idle', 0.5, RADIUS);
      // |[x,y,z]| === RADIUS exactly (we normalise + scale by R)
      expect(Math.hypot(x, y, z)).toBeCloseTo(RADIUS, 4);
    }
  });

  it('progress value has no effect in idle mode', () => {
    const a = burstOffset(7, 'idle', 0, RADIUS);
    const b = burstOffset(7, 'idle', 0.5, RADIUS);
    const c = burstOffset(7, 'idle', 1.0, RADIUS);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe('burstOffset — inward mode (materialising)', () => {
  it('progress=0 → particle at the bounds (about to fly in)', () => {
    const [x, y, z] = burstOffset(0, 'inward', 0, RADIUS);
    expect(Math.hypot(x, y, z)).toBeCloseTo(RADIUS, 4);
  });

  it('progress=1 → particle at origin (settled)', () => {
    const [x, y, z] = burstOffset(0, 'inward', 1, RADIUS);
    expect(Math.hypot(x, y, z)).toBeCloseTo(0, 6);
  });

  it('progress=0.5 → particle at half-radius', () => {
    const i = 3;
    const [x, y, z] = burstOffset(i, 'inward', 0.5, RADIUS);
    expect(Math.hypot(x, y, z)).toBeCloseTo(RADIUS / 2, 4);
  });
});

describe('burstOffset — outward mode (dissolving)', () => {
  it('progress=0 → particle at origin', () => {
    const [x, y, z] = burstOffset(5, 'outward', 0, RADIUS);
    expect(Math.hypot(x, y, z)).toBeCloseTo(0, 6);
  });

  it('progress=1 → particle at bounds', () => {
    const [x, y, z] = burstOffset(5, 'outward', 1, RADIUS);
    expect(Math.hypot(x, y, z)).toBeCloseTo(RADIUS, 4);
  });
});

describe('burstOffset — direction stability', () => {
  it('direction unit vector is stable across modes + progress for same index', () => {
    const i = 11;
    const idle = burstOffset(i, 'idle', 1, RADIUS);
    const inward = burstOffset(i, 'inward', 0, RADIUS);
    const outward = burstOffset(i, 'outward', 1, RADIUS);
    // All three are at the bounds; same direction.
    expect(idle[0]).toBeCloseTo(inward[0], 4);
    expect(idle[1]).toBeCloseTo(inward[1], 4);
    expect(idle[2]).toBeCloseTo(inward[2], 4);
    expect(idle[0]).toBeCloseTo(outward[0], 4);
  });
});

describe('burstOffset — progress clamps to [0, 1]', () => {
  it('inward + progress=2 = inward + progress=1 (origin)', () => {
    expect(burstOffset(0, 'inward', 2, RADIUS)).toEqual(burstOffset(0, 'inward', 1, RADIUS));
  });

  it('outward + progress=-1 = outward + progress=0 (origin)', () => {
    expect(burstOffset(0, 'outward', -1, RADIUS)).toEqual(burstOffset(0, 'outward', 0, RADIUS));
  });
});

describe('noise1 (internal)', () => {
  const { noise1 } = __testing;
  it('produces values in [-1, 1]', () => {
    for (let i = 0; i < 100; i += 1) {
      for (let d = 0; d < 4; d += 1) {
        const v = noise1(i, d);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    expect(noise1(7, 0)).toBe(noise1(7, 0));
    expect(noise1(99, 2)).toBe(noise1(99, 2));
  });
});
