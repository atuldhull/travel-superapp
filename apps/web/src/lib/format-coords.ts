/**
 * AE221 — pure lat/lng pretty-printing helpers.
 *
 * Atlas tooltips + journey-dashboard centre badge + future map-card
 * surfaces each need a calm, fixed-precision rendering of {lat,lng}.
 * This helper canonicalises:
 *   - 4-decimal precision (~11 m accuracy — readable, not noisy)
 *   - hemisphere suffix (N/S, E/W) for human-friendliness
 *   - degenerate / out-of-range / NaN → '—'
 *
 * Rule: equator + prime meridian both render with 'N' / 'E' (positive
 * 0 = north + east hemisphere by convention). Negatives flip.
 */

const DASH = '—';

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

function isFiniteInRange(n: number, max: number): boolean {
  return Number.isFinite(n) && n >= -max && n <= max;
}

export function formatLat(lat: number): string {
  if (isFiniteInRange(lat, 90) === false) return DASH;
  const abs = Math.abs(lat).toFixed(4);
  const hemi = lat < 0 ? 'S' : 'N';
  return `${abs}° ${hemi}`;
}

export function formatLng(lng: number): string {
  if (isFiniteInRange(lng, 180) === false) return DASH;
  const abs = Math.abs(lng).toFixed(4);
  const hemi = lng < 0 ? 'W' : 'E';
  return `${abs}° ${hemi}`;
}

export function formatLatLng(p: LatLng): string {
  const lat = formatLat(p.lat);
  const lng = formatLng(p.lng);
  if (lat === DASH || lng === DASH) return DASH;
  return `${lat}, ${lng}`;
}
