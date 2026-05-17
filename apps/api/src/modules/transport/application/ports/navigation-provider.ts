/**
 * Port for a turn-aware navigation provider — returns drawable road
 * routes (geometry + ETA + flavour) for an origin → destination with
 * optional via-waypoints.
 *
 * Adapters:
 *   - `OsrmNavigationProvider`   — real road routing via the public
 *     OSRM demo server (free, no key, supports `alternatives`).
 *   - `MockNavigationProvider`   — deterministic synthetic geometry
 *     (offline + test path; always returns 3 flavours).
 *   - `CompositeNavigationProvider` — OSRM with mock fallback so the
 *     UI never sees an error.
 *
 * Traffic is layered on separately by the use-case via
 * `TrafficProvider`, so this port stays a pure "give me the lines".
 */
import type { RawNavRoute } from '../../domain/nav-route.entity';

export interface NavigationInput {
  readonly originLat: number;
  readonly originLng: number;
  readonly destinationLat: number;
  readonly destinationLng: number;
  /** Optional intermediate stops, in visiting order. */
  readonly waypoints?: ReadonlyArray<{ readonly lat: number; readonly lng: number }>;
}

export interface NavigationProvider {
  /** Returns ≥1 route. Implementations MUST NOT throw for a
   *  reachable-but-routeless query — they return an empty array and
   *  the use-case maps that to a domain error. They MAY throw on
   *  transport failure so the composite can fall back. */
  getRoutes(input: NavigationInput): Promise<readonly RawNavRoute[]>;
}

export const NAVIGATION_PROVIDER = Symbol('NavigationProvider');
