/** AE404 — pure aspectFromTexture helper. */
import { aspectFromTexture } from '../src/photo-plane';
import type { Texture } from 'three';

function fakeTexture(w: unknown, h: unknown): Texture {
  return { image: { width: w, height: h } } as unknown as Texture;
}

describe('aspectFromTexture (pure)', () => {
  it('null texture → fallback', () => {
    expect(aspectFromTexture(null, 0.66)).toBe(0.66);
  });
  it('returns image.height / image.width', () => {
    const tex = fakeTexture(1200, 800); // 2:3-ish landscape
    expect(aspectFromTexture(tex, 0.66)).toBeCloseTo(800 / 1200, 9);
  });
  it('square image → 1.0', () => {
    expect(aspectFromTexture(fakeTexture(500, 500), 0.66)).toBe(1);
  });
  it('portrait image → > 1.0', () => {
    expect(aspectFromTexture(fakeTexture(600, 900), 0.66)).toBeCloseTo(900 / 600, 9);
  });
  it('missing image field → fallback', () => {
    expect(aspectFromTexture({} as unknown as Texture, 0.66)).toBe(0.66);
  });
  it('non-finite / zero width → fallback', () => {
    expect(aspectFromTexture(fakeTexture(0, 100), 0.66)).toBe(0.66);
    expect(aspectFromTexture(fakeTexture(Number.NaN, 100), 0.66)).toBe(0.66);
    expect(aspectFromTexture(fakeTexture(Number.POSITIVE_INFINITY, 100), 0.66)).toBe(0.66);
  });
  it('non-finite / zero height → fallback', () => {
    expect(aspectFromTexture(fakeTexture(100, 0), 0.66)).toBe(0.66);
    expect(aspectFromTexture(fakeTexture(100, Number.NaN), 0.66)).toBe(0.66);
  });
  it('honours arbitrary fallback', () => {
    expect(aspectFromTexture(null, 1.5)).toBe(1.5);
  });
});
