/** AE388 — WeatherStreaks pure y-position math specs. */
import { __testing, streakYAt } from '../src/weather-streaks';

describe('streakYAt', () => {
  it('returns 0 for non-positive height', () => {
    expect(streakYAt(0, 1.5, 6, 0)).toBe(0);
    expect(streakYAt(0, 1.5, 6, -1)).toBe(0);
  });

  it('stays within [-height/2, +height/2]', () => {
    const height = 10;
    for (let i = 0; i < 50; i += 1) {
      for (const t of [0, 0.5, 1.2, 3.7, 17.3]) {
        const y = streakYAt(i, t, 6, height);
        expect(y).toBeGreaterThanOrEqual(-height / 2 - 1e-6);
        expect(y).toBeLessThanOrEqual(height / 2 + 1e-6);
      }
    }
  });

  it('advances toward -y as t grows (within one cycle)', () => {
    // For a single particle, picking a phase such that the streak
    // doesn't wrap during the window: the seeded phase varies, so just
    // assert SOME particles fall during a small forward step. Sample 20
    // particles; expect the majority to decrease in y.
    let decreased = 0;
    for (let i = 0; i < 20; i += 1) {
      const y0 = streakYAt(i, 0, 1, 100); // large height so we're far from wrap
      const y1 = streakYAt(i, 1, 1, 100);
      if (y1 < y0) decreased += 1;
    }
    expect(decreased).toBeGreaterThanOrEqual(15);
  });

  it('wraps modulo height — same particle at t and t+height/speed share y', () => {
    const height = 10;
    const speed = 6;
    const period = height / speed; // cycle period in seconds
    for (let i = 0; i < 10; i += 1) {
      const a = streakYAt(i, 1.23, speed, height);
      const b = streakYAt(i, 1.23 + period, speed, height);
      expect(b).toBeCloseTo(a, 6);
    }
  });

  it('different particles at the same t have different phases', () => {
    // Sample 30 particles at the same time; expect a wide spread.
    const ys = Array.from({ length: 30 }, (_, i) => streakYAt(i, 1.0, 6, 10));
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    expect(max - min).toBeGreaterThan(3); // a fair fraction of the 10 height
  });
});

describe('noise1 (internal)', () => {
  const { noise1 } = __testing;
  it('produces values in [-1, 1]', () => {
    for (let i = 0; i < 100; i += 1) {
      for (let d = 0; d < 8; d += 1) {
        const v = noise1(i, d);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    expect(noise1(7, 5)).toBe(noise1(7, 5));
  });
});
