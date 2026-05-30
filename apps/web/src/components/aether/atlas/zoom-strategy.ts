/**
 * AE281 — pure animation strategy picker for Atlas zoom changes.
 *
 * Leaflet's `setView` either snaps instantly or animates via
 * `flyTo`. Large zoom deltas look jarring at full animate-speed;
 * tiny deltas feel slow when animated. Rule:
 *
 *   |Δz| <= SMALL_DELTA → 'snap'        (no animation needed)
 *   |Δz| >  LARGE_DELTA → 'snap'        (too jumpy if animated)
 *   else                → 'animate'
 *
 * The same gate applies to reduced-motion users: always snap.
 */

export const SMALL_ZOOM_DELTA = 1;
export const LARGE_ZOOM_DELTA = 6;

export type ZoomStrategy = 'snap' | 'animate';

export interface ZoomStrategyInputs {
  readonly fromZoom: number;
  readonly toZoom: number;
  readonly reducedMotion: boolean;
}

export function pickZoomStrategy(inputs: ZoomStrategyInputs): ZoomStrategy {
  if (inputs.reducedMotion === true) return 'snap';
  const delta = Math.abs(inputs.toZoom - inputs.fromZoom);
  if (delta <= SMALL_ZOOM_DELTA) return 'snap';
  if (delta > LARGE_ZOOM_DELTA) return 'snap';
  return 'animate';
}
