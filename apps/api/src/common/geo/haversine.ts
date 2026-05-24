/**
 * Shared geo math primitives ([J2]).
 *
 * Two callers (`build-food-crawl.use-case.ts`,
 * `get-routes.use-case.ts`) previously had hand-copied haversine
 * implementations — one returning metres, one returning km. Same
 * formula, same constant, same opportunity for a regression on one
 * side to silently leave the other side correct.
 *
 * `haversineMeters` is the canonical form. `haversineKm` is a
 * one-liner derivative. Both go through the same physics constant
 * for Earth's mean radius. Persisted measurements still go through
 * PostGIS `ST_Distance(::geography)` per CLAUDE.md #11 — these are
 * for in-memory ranking / cap-enforcement only.
 *
 * `assertValidCoordinates` is the WGS-84 lat/lng range guard the
 * report-scam + trigger-sos use-cases also duplicate. Lifting it
 * here lets [J2]'s property-based fuzz target one place.
 *
 * Installed by prompt [J2].
 */
import { ValidationError } from '@app/errors';

/** Earth's mean radius (IUGG mean), in metres. The WGS-84 ellipsoid
 *  varies by ~21 km between equator + poles; the mean is good enough
 *  for the sub-1%-error needs of crawl ranking / route caps. */
export const EARTH_RADIUS_METRES = 6_371_000;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** WGS-84 great-circle distance in METRES. Symmetric, non-negative,
 *  identity-zero, respects triangle inequality (the property tests
 *  in `geo-math.property.spec.ts` cover all four). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  // Clamp at 1.0 so floating-point overshoot at antipodal points
  // (where h can numerically exceed 1) doesn't NaN out via asin.
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Convenience wrapper — same calculation, kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) / 1000;
}

/** Throws `ValidationError(INVALID_COORDINATES)` if either coordinate
 *  is not a finite WGS-84 value. The lat domain is `[-90, 90]`; the
 *  lng domain is `[-180, 180]`. `±0` is accepted at either edge. */
export function assertValidCoordinates(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ValidationError(
      'Latitude out of range',
      { lat: ['must be between -90 and 90'] },
      { lat },
      'INVALID_COORDINATES',
    );
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError(
      'Longitude out of range',
      { lng: ['must be between -180 and 180'] },
      { lng },
      'INVALID_COORDINATES',
    );
  }
}

/** Axis-aligned bounding box on the unit sphere (with the lng meridian
 *  not crossing antimeridian, sufficient for every consumer today). */
export interface Bbox {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
}

/** True iff `point` lies inside (or on the edge of) `bbox`. Caller is
 *  responsible for ensuring the bbox doesn't wrap the antimeridian. */
export function isInBbox(point: LatLng, bbox: Bbox): boolean {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  );
}
