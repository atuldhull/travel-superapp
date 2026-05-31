/** AE375 — DepthFog pure-helper specs (`linearFogDensity`).
 *  The <DepthFog/> component itself isn't tested here — it requires an R3F
 *  context which the canvas jest config doesn't provide. */
import { linearFogDensity } from '../src/depth-fog';

describe('linearFogDensity', () => {
  it('returns 0 at or before `near`', () => {
    expect(linearFogDensity(0, 10, 30)).toBe(0);
    expect(linearFogDensity(10, 10, 30)).toBe(0);
  });

  it('returns 1 at or past `far`', () => {
    expect(linearFogDensity(30, 10, 30)).toBe(1);
    expect(linearFogDensity(100, 10, 30)).toBe(1);
  });

  it('interpolates linearly between near and far', () => {
    expect(linearFogDensity(20, 10, 30)).toBeCloseTo(0.5, 6);
    expect(linearFogDensity(15, 10, 30)).toBeCloseTo(0.25, 6);
    expect(linearFogDensity(25, 10, 30)).toBeCloseTo(0.75, 6);
  });

  it('returns 0 when far <= near (degenerate input)', () => {
    expect(linearFogDensity(15, 30, 10)).toBe(0);
    expect(linearFogDensity(15, 10, 10)).toBe(0);
  });

  it('clamps to [0, 1] for any input', () => {
    const d = linearFogDensity(-10, 0, 1);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });
});
