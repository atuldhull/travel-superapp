/**
 * AE262 — pure approximate-zoom-level derivation from a Leaflet
 * bounding box.
 *
 * Used by Atlas "fit to filtered pins" so we can pre-compute the
 * zoom the map will end up at and decide whether to animate or
 * snap (large zoom changes look jarring at full speed).
 *
 * The math is a rough approximation suitable for UX heuristics, not
 * geodesic accuracy. It picks the zoom such that the larger of the
 * two dimensions fits in ~360 horizontal degrees:
 *
 *   z = floor(log2(360 / maxDim))
 *
 * Returns a clamped integer in [0, 18] (Leaflet's default range).
 * Returns null for a null or degenerate bbox.
 */
import type { PinBBox } from './pins-bbox';

export const MIN_ZOOM = 0;
export const MAX_ZOOM = 18;

export function zoomFromBBox(bbox: PinBBox | null): number | null {
  if (bbox === null) return null;
  const dx = Math.max(1e-6, bbox.east - bbox.west);
  const dy = Math.max(1e-6, bbox.north - bbox.south);
  const maxDim = Math.max(dx, dy);
  const z = Math.floor(Math.log2(360 / maxDim));
  if (Number.isNaN(z)) return null;
  if (z < MIN_ZOOM) return MIN_ZOOM;
  if (z > MAX_ZOOM) return MAX_ZOOM;
  return z;
}
