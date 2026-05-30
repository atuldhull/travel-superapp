/**
 * AE230 — pure bounding-box derivation for an Atlas pin set.
 *
 * Atlas wants to "fit the map to filtered pins" — i.e. compute the
 * lat/lng min+max corners so Leaflet's fitBounds can zoom to the
 * smallest viewport that contains them. The math is trivial but
 * easy to slip on the "empty array" edge: returning a `null` bbox
 * is the contract.
 *
 * Returns `null` when:
 *   - input is empty
 *   - any pin has a non-finite lat/lng (defensive against bad data)
 *
 * Otherwise returns
 *   { south, north, west, east } with `south <= north` and `west <= east`.
 */

export interface PinLike {
  readonly lat: number;
  readonly lng: number;
}

export interface PinBBox {
  readonly south: number;
  readonly north: number;
  readonly west: number;
  readonly east: number;
}

export function pinsBBox(pins: ReadonlyArray<PinLike>): PinBBox | null {
  if (pins.length === 0) return null;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  for (const p of pins) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }
  return { south, north, west, east };
}
