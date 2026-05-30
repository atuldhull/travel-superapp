/**
 * AE292 — pure pretty-distance formatter for the AE71 geolocation
 * nearest-pin chip + future Atlas hover read-outs.
 *
 * Rules:
 *   < 1 km     → '<n> m' (whole meters)
 *   < 10 km    → 'X.X km' (one decimal)
 *   else       → 'XXX km' (whole km)
 *   NaN / negative → '—'
 */

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}
