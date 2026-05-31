/**
 * AE302 — pure geometric centre derivation for a pin set.
 *
 * Pairs with AE230 pinsBBox for the "fit to filtered pins" flow:
 * after pinsBBox tells us the corners, this helper gives the
 * Leaflet `setView` centre. Uses bbox midpoint (NOT the mean of
 * lat/lng), so outliers don't drag the camera.
 *
 * Returns null for an empty / degenerate set so the caller falls
 * back to DEFAULT_CENTER (Jaipur).
 */

import type { PinLike } from './pins-bbox';
import { pinsBBox } from './pins-bbox';

export interface LatLngCenter {
  readonly lat: number;
  readonly lng: number;
}

export function centerOfPins(pins: ReadonlyArray<PinLike>): LatLngCenter | null {
  const bbox = pinsBBox(pins);
  if (bbox === null) return null;
  return {
    lat: (bbox.south + bbox.north) / 2,
    lng: (bbox.west + bbox.east) / 2,
  };
}
