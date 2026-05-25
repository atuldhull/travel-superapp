/**
 * Real road-routing adapter — the public OSRM demo server
 * (`router.project-osrm.org`, free, no key, fair-use). Asks for
 * `alternatives` so we get a few genuinely different lines, then
 * labels them by shape: the quickest is "fastest", the longest is
 * the "scenic / more adventurous" one, and the middle is offered as
 * the "traffic-avoiding" candidate (real avoidance is layered on by
 * the traffic provider + the use-case's recommendation rule).
 *
 * Any transport failure / non-`Ok` body throws so
 * `CompositeNavigationProvider` can fall back to the deterministic
 * mock — the UI never sees an error.
 *
 * Native fetch (no SDK), short timeout, GeoJSON geometry so we get
 * [lng,lat] arrays without polyline-decoding.
 *
 * Installed for the live-navigation feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type { NavPoint, NavRouteFlavor, RawNavRoute } from '../domain/nav-route.entity';
import type { NavigationInput, NavigationProvider } from '../application/ports/navigation-provider';

const TIMEOUT_MS = 5000;
const MAX_ALTERNATIVES = 3;

interface OsrmRoute {
  readonly distance: number;
  readonly duration: number;
  readonly geometry: { readonly coordinates: ReadonlyArray<readonly [number, number]> };
}
interface OsrmResponse {
  readonly code: string;
  readonly routes?: readonly OsrmRoute[];
}

/** Pure + unit-testable: builds the OSRM driving URL. Coordinates are
 *  `lng,lat` pairs separated by `;` (OSRM order). */
export function buildOsrmUrl(baseUrl: string, points: readonly NavPoint[]): string {
  const base = baseUrl.replace(/\/+$/, '');
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  return (
    `${base}/route/v1/driving/${coords}` +
    `?alternatives=${MAX_ALTERNATIVES}&overview=full&geometries=geojson&steps=false`
  );
}

@Injectable()
export class OsrmNavigationProvider implements NavigationProvider {
  private readonly logger: AppLogger = createLogger('transport.nav.osrm');
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly baseUrl: string,
    @Inject(CLOCK) clock: Clock,
  ) {
    // [O1] 5 fails / 60s. OSRM throws on failure → composite falls
    // back to mock; breaker stops the timeout latency from
    // accumulating.
    this.breaker = new CircuitBreaker({
      name: 'osrm',
      clock,
      failureThreshold: 5,
      openMs: 60_000,
      onTransition: (from, to, name) =>
        this.logger.warn({ from, to, name }, 'circuit_state_change'),
    });
  }

  async getRoutes(input: NavigationInput): Promise<readonly RawNavRoute[]> {
    const points: NavPoint[] = [
      { lat: input.originLat, lng: input.originLng },
      ...(input.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: input.destinationLat, lng: input.destinationLng },
    ];
    const url = buildOsrmUrl(this.baseUrl, points);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await callExternal(() => fetch(url, { signal: ctrl.signal }), {
        breaker: this.breaker,
        label: 'osrm.route',
      });
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const json = (await res.json()) as OsrmResponse;
      if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
        throw new Error(`OSRM code=${json.code}`);
      }
      return labelRoutes(json.routes);
    } catch (err) {
      // Throw → composite falls back to mock. Log at warn (expected
      // on the free demo server under load / offline dev).
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'osrm_navigation_unavailable',
      );
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Quickest = fastest; longest distance = scenic; remaining = the
 *  avoid-traffic candidate. With <3 alternatives we still always
 *  return at least the fastest. */
function labelRoutes(routes: readonly OsrmRoute[]): RawNavRoute[] {
  const byDuration = [...routes].sort((a, b) => a.duration - b.duration);
  const fastest = byDuration[0]!;
  const rest = byDuration.slice(1);
  const scenic =
    rest.length > 0 ? [...rest].sort((a, b) => b.distance - a.distance)[0]! : undefined;
  const avoid = rest.find((r) => r !== scenic);

  const out: RawNavRoute[] = [toRaw(fastest, 'fastest', 'Fastest route')];
  if (scenic) out.push(toRaw(scenic, 'scenic', 'Scenic — more adventurous'));
  if (avoid) out.push(toRaw(avoid, 'avoid_traffic', 'Traffic-avoiding'));
  return out;
}

function toRaw(r: OsrmRoute, flavor: NavRouteFlavor, label: string): RawNavRoute {
  return {
    id: `osrm-${flavor}`,
    flavor,
    label,
    distanceMeters: Math.round(r.distance),
    durationSeconds: Math.round(r.duration),
    geometry: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }) satisfies NavPoint),
  };
}
