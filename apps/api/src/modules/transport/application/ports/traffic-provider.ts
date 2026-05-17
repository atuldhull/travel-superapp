/**
 * Port for a traffic-enrichment provider. Given a route's polyline,
 * it returns per-stretch congestion classes + advisories + a
 * traffic-aware ETA delta.
 *
 * Adapters:
 *   - `TomTomTrafficProvider`   — real flow data (needs TOMTOM_API_KEY;
 *     limited free tier). Best-effort: any failure throws so the
 *     composite falls back.
 *   - `MockTrafficProvider`     — deterministic synthetic congestion
 *     (seeded from geometry) so the feature works $0 / offline / in
 *     tests, including a demo blockage→reroute on the fastest route.
 *   - `CompositeTrafficProvider` — TomTom when keyed, else mock.
 */
import type {
  NavAdvisory,
  NavPoint,
  NavRouteFlavor,
  TrafficSegment,
  TrafficSource,
} from '../../domain/nav-route.entity';

export interface TrafficAnnotateInput {
  /** Stable id of the route being annotated (used as the mock seed). */
  readonly routeId: string;
  readonly flavor: NavRouteFlavor;
  readonly geometry: readonly NavPoint[];
  /** Free-flow duration from the routing provider, in seconds. */
  readonly baseDurationSeconds: number;
}

export interface TrafficAnnotation {
  readonly segments: readonly TrafficSegment[];
  readonly advisories: readonly NavAdvisory[];
  /** Free-flow duration adjusted for the congestion found. */
  readonly durationInTrafficSeconds: number;
  readonly source: TrafficSource;
}

export interface TrafficProvider {
  annotate(input: TrafficAnnotateInput): Promise<TrafficAnnotation>;
}

export const TRAFFIC_PROVIDER = Symbol('TrafficProvider');
