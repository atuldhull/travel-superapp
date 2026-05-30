/**
 * Vitest specs for AE262 zoomFromBBox.
 */
import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, zoomFromBBox } from '../../src/components/aether/atlas/zoom-from-bbox';

describe('zoomFromBBox', () => {
  it('null bbox → null', () => {
    expect(zoomFromBBox(null)).toBeNull();
  });

  it('full Earth (360x180) → zoom 0', () => {
    expect(zoomFromBBox({ south: -90, north: 90, west: -180, east: 180 })).toBe(0);
  });

  it('180-wide → zoom 1', () => {
    expect(zoomFromBBox({ south: -45, north: 45, west: -90, east: 90 })).toBe(1);
  });

  it('1-degree wide → high zoom', () => {
    const z = zoomFromBBox({ south: 28, north: 29, west: 77, east: 78 });
    expect(z).toBeGreaterThanOrEqual(8);
  });

  it('degenerate (zero-width) bbox returns MAX_ZOOM', () => {
    expect(zoomFromBBox({ south: 20, north: 20, west: 75, east: 75 })).toBe(MAX_ZOOM);
  });

  it('clamps to MIN_ZOOM', () => {
    // Synthetic huge dimension — never happens but assert clamp.
    expect(zoomFromBBox({ south: -1000, north: 1000, west: -1000, east: 1000 })).toBe(MIN_ZOOM);
  });

  it('clamps to MAX_ZOOM', () => {
    expect(zoomFromBBox({ south: 20.0001, north: 20.0002, west: 75.0001, east: 75.0002 })).toBe(
      MAX_ZOOM,
    );
  });

  it('Indian bbox (Leh→Alleppey N-S) yields a reasonable mid zoom', () => {
    // dy ~= 24.66 → maxDim = 24.66 → 360/24.66 = 14.6 → log2 = 3.87 → floor = 3.
    const z = zoomFromBBox({ south: 9.49, north: 34.15, west: 75.78, east: 77.57 });
    expect(z).toBeGreaterThanOrEqual(3);
    expect(z).toBeLessThan(7);
  });

  it('returns an integer', () => {
    const z = zoomFromBBox({ south: 9.49, north: 34.15, west: 75.78, east: 77.57 });
    expect(z !== null && Number.isInteger(z)).toBe(true);
  });
});
