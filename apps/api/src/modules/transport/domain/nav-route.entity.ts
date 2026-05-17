/**
 * Plain-data domain types for **turn-aware live navigation** — the
 * "animated route + alternatives + live traffic + reroute" surface
 * that powers the web LiveNavMap.
 *
 * Distinct from `RouteLeg` (one cost/duration estimate per transport
 * MODE). A `NavRoute` is a single drawable driving line: real road
 * geometry, an ETA, per-stretch traffic colouring, and human
 * advisories ("blockage ahead — take the alternative"). The provider
 * returns several `NavRoute`s — a "fastest", a longer "scenic / more
 * adventurous", and a "traffic-avoiding" flavour — so the UI can let
 * the traveller pick.
 *
 * Pure data, no Nest/Prisma imports — safe for the application layer
 * to depend on (clean/hex: domain has zero outward deps).
 *
 * Installed for the live-navigation feature (user-directed, $0 base
 * via OSRM; live traffic behind an optional TomTom key with a
 * deterministic mock fallback).
 */

/** Which "kind" of route this is. The provider labels each one so
 *  the UI can offer Fastest / Scenic / Avoid-traffic toggles. */
export type NavRouteFlavor = 'fastest' | 'scenic' | 'avoid_traffic';

/** Congestion class for a stretch of the polyline. `blocked` means a
 *  closure / incident — the use-case turns the first `blocked` stretch
 *  into a reroute advisory. */
export type TrafficLevel = 'free' | 'moderate' | 'heavy' | 'blocked';

/** Where the traffic colouring came from, surfaced to the client so
 *  it can label "live" vs "estimated". */
export type TrafficSource = 'live' | 'mock' | 'none';

/** Where the route geometry itself came from. */
export type RouteSource = 'osrm' | 'mock';

export interface NavPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * A contiguous run of the route geometry sharing one congestion
 * class. Indices are into the owning route's `geometry` array
 * (`fromIndex` inclusive, `toIndex` inclusive) so the client can draw
 * a coloured sub-polyline without re-deriving geometry.
 */
export interface TrafficSegment {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly level: TrafficLevel;
}

/** A human-facing nudge attached to a route. `reroute`/`blockage`
 *  carry the coordinate of the incident so the UI can pin it. */
export interface NavAdvisory {
  readonly kind: 'blockage' | 'heavy_traffic' | 'reroute' | 'scenic_tip';
  readonly message: string;
  readonly atLat?: number;
  readonly atLng?: number;
}

/** A route BEFORE traffic enrichment — what a NavigationProvider
 *  returns. The use-case layers traffic on top to make a `NavRoute`. */
export interface RawNavRoute {
  readonly id: string;
  readonly flavor: NavRouteFlavor;
  readonly label: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly geometry: readonly NavPoint[];
}

/** A fully-assembled, drawable route with live(ish) traffic. */
export interface NavRoute extends RawNavRoute {
  /** ETA accounting for the traffic colouring. Equals
   *  `durationSeconds` when no traffic data was available. */
  readonly durationInTrafficSeconds: number;
  readonly trafficSegments: readonly TrafficSegment[];
  readonly advisories: readonly NavAdvisory[];
  readonly trafficSource: TrafficSource;
}

/** The full response: every route option + which one we recommend
 *  right now (lowest traffic-aware ETA, avoiding blocked routes). */
export interface NavRouteSet {
  readonly routes: readonly NavRoute[];
  readonly recommendedRouteId: string;
  readonly routeSource: RouteSource;
}
