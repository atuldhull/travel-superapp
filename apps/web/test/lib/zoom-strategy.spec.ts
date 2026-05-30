/**
 * Vitest specs for AE281 pickZoomStrategy.
 */
import { describe, expect, it } from 'vitest';
import {
  LARGE_ZOOM_DELTA,
  SMALL_ZOOM_DELTA,
  pickZoomStrategy,
} from '../../src/components/aether/atlas/zoom-strategy';

const R = false; // reducedMotion = false

describe('pickZoomStrategy', () => {
  it('no change → snap (delta 0)', () => {
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 5, reducedMotion: R })).toBe('snap');
  });

  it('1-step zoom → snap (too small to animate)', () => {
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 6, reducedMotion: R })).toBe('snap');
    expect(pickZoomStrategy({ fromZoom: 6, toZoom: 5, reducedMotion: R })).toBe('snap');
  });

  it('2-step zoom → animate', () => {
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 7, reducedMotion: R })).toBe('animate');
  });

  it('boundary at LARGE_ZOOM_DELTA → still animate', () => {
    expect(pickZoomStrategy({ fromZoom: 4, toZoom: 4 + LARGE_ZOOM_DELTA, reducedMotion: R })).toBe(
      'animate',
    );
  });

  it('above LARGE_ZOOM_DELTA → snap (too jumpy)', () => {
    expect(
      pickZoomStrategy({ fromZoom: 4, toZoom: 4 + LARGE_ZOOM_DELTA + 1, reducedMotion: R }),
    ).toBe('snap');
  });

  it('reducedMotion=true always snaps', () => {
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 7, reducedMotion: true })).toBe('snap');
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 5, reducedMotion: true })).toBe('snap');
    expect(pickZoomStrategy({ fromZoom: 5, toZoom: 18, reducedMotion: true })).toBe('snap');
  });

  it('constants are sane', () => {
    expect(SMALL_ZOOM_DELTA).toBeGreaterThanOrEqual(0);
    expect(LARGE_ZOOM_DELTA).toBeGreaterThan(SMALL_ZOOM_DELTA);
  });
});
