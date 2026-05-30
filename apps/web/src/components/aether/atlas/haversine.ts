/**
 * AE170 — Atlas geo helpers extracted from atlas-canvas.tsx (AE71).
 *
 * Pure great-circle distance + nearest-pin search. Lifted so the
 * "Where am I?" + "Nearest destination" features can be unit-tested
 * without Leaflet, jsdom geolocation, or the surrounding shell.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Haversine distance in kilometres. Accurate to ~0.5% over India
 *  -scale spans; we don't need ellipsoid precision for "nearest". */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Find the pin closest to `here`. Returns null when the candidate
 *  list is empty so the caller doesn't have to handle undefined. */
export function nearestPin<P extends LatLng>(
  here: LatLng,
  pins: ReadonlyArray<P>,
): { readonly pin: P; readonly km: number } | null {
  let best: { pin: P; km: number } | null = null;
  for (const p of pins) {
    const km = haversineKm(here, p);
    if (best === null || km < best.km) best = { pin: p, km };
  }
  return best;
}
