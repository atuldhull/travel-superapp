/**
 * Build the live-navigation route set for an origin → destination
 * (with optional via-stops): validate + clamp inputs, ask the
 * navigation provider for road geometry + alternatives, layer traffic
 * on each route, then pick the recommended one.
 *
 * Recommendation rule: lowest traffic-aware ETA among routes with NO
 * `blocked` stretch; if every route is blocked, the lowest ETA wins;
 * ties break toward the `fastest` flavour. This is what makes
 * "there's a blockage — take the 2nd route" fall out automatically.
 *
 * Distance cap: 1500km straight-line. Live nav is a road-trip
 * surface, so the cap is far higher than `GetRoutesUseCase`'s 500km
 * mode-fit cap, but still bounded — beyond that it's flight territory.
 *
 * Installed for the live-navigation feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { NavRoute, NavRouteSet } from '../domain/nav-route.entity';
import { NAVIGATION_PROVIDER, type NavigationProvider } from './ports/navigation-provider';
import { TRAFFIC_PROVIDER, type TrafficProvider } from './ports/traffic-provider';

const MAX_STRAIGHT_LINE_KM = 1500;
const MAX_WAYPOINTS = 8;
const EARTH_RADIUS_KM = 6371;

interface Coord {
  readonly lat: number;
  readonly lng: number;
}

export interface GetNavigationCommand {
  readonly origin: Coord;
  readonly destination: Coord;
  readonly waypoints?: readonly Coord[];
}

@Injectable()
export class GetNavigationUseCase {
  constructor(
    @Inject(NAVIGATION_PROVIDER) private readonly navigation: NavigationProvider,
    @Inject(TRAFFIC_PROVIDER) private readonly traffic: TrafficProvider,
  ) {}

  async execute(cmd: GetNavigationCommand): Promise<NavRouteSet> {
    assertCoord('origin.lat', cmd.origin.lat, -90, 90);
    assertCoord('origin.lng', cmd.origin.lng, -180, 180);
    assertCoord('destination.lat', cmd.destination.lat, -90, 90);
    assertCoord('destination.lng', cmd.destination.lng, -180, 180);

    const waypoints = cmd.waypoints ?? [];
    if (waypoints.length > MAX_WAYPOINTS) {
      throw new ValidationError(
        `Too many waypoints (${waypoints.length}; max ${MAX_WAYPOINTS})`,
        { waypoints: [`at most ${MAX_WAYPOINTS} allowed`] },
        { count: waypoints.length, max: MAX_WAYPOINTS },
        'TOO_MANY_WAYPOINTS',
      );
    }
    waypoints.forEach((w, i) => {
      assertCoord(`waypoints[${i}].lat`, w.lat, -90, 90);
      assertCoord(`waypoints[${i}].lng`, w.lng, -180, 180);
    });

    if (
      cmd.origin.lat === cmd.destination.lat &&
      cmd.origin.lng === cmd.destination.lng &&
      waypoints.length === 0
    ) {
      throw new ValidationError(
        'Origin and destination must differ',
        { destination: ['must differ from origin'] },
        { origin: cmd.origin, destination: cmd.destination },
        'SAME_ORIGIN_DESTINATION',
      );
    }

    // Cap the longest single hop so an absurd query can't make the
    // provider chew on inter-continental routing.
    const hops: Coord[] = [cmd.origin, ...waypoints, cmd.destination];
    for (let i = 1; i < hops.length; i += 1) {
      const km = haversineKm(hops[i - 1]!, hops[i]!);
      if (km > MAX_STRAIGHT_LINE_KM) {
        throw new ValidationError(
          `Route hop too long (${Math.round(km)}km straight-line; max ${MAX_STRAIGHT_LINE_KM}km)`,
          { destination: [`each hop must be within ${MAX_STRAIGHT_LINE_KM}km`] },
          { hopKm: Math.round(km), max: MAX_STRAIGHT_LINE_KM },
          'ROUTE_TOO_LONG',
        );
      }
    }

    const raw = await this.navigation.getRoutes({
      originLat: cmd.origin.lat,
      originLng: cmd.origin.lng,
      destinationLat: cmd.destination.lat,
      destinationLng: cmd.destination.lng,
      ...(waypoints.length > 0 ? { waypoints } : {}),
    });

    if (raw.length === 0) {
      throw new ValidationError(
        'No route found between these points',
        { destination: ['unroutable from origin'] },
        { origin: cmd.origin, destination: cmd.destination },
        'NO_ROUTE_FOUND',
      );
    }

    const routes: NavRoute[] = await Promise.all(
      raw.map(async (r) => {
        const ann = await this.traffic.annotate({
          routeId: r.id,
          flavor: r.flavor,
          geometry: r.geometry,
          baseDurationSeconds: r.durationSeconds,
        });
        return {
          ...r,
          durationInTrafficSeconds: ann.durationInTrafficSeconds,
          trafficSegments: ann.segments,
          advisories: ann.advisories,
          trafficSource: ann.source,
        } satisfies NavRoute;
      }),
    );

    return {
      routes,
      recommendedRouteId: pickRecommended(routes),
      routeSource: raw[0]!.id.startsWith('mock-') ? 'mock' : 'osrm',
    };
  }
}

/** Lowest traffic-aware ETA among non-blocked routes; fall back to
 *  the global lowest ETA; tie-break toward `fastest`. */
function pickRecommended(routes: readonly NavRoute[]): string {
  const isBlocked = (r: NavRoute): boolean => r.trafficSegments.some((s) => s.level === 'blocked');
  const rank = (r: NavRoute): [number, number] => [
    r.durationInTrafficSeconds,
    r.flavor === 'fastest' ? 0 : 1,
  ];
  const clear = routes.filter((r) => !isBlocked(r));
  const pool = clear.length > 0 ? clear : routes;
  const best = [...pool].sort((a, b) => {
    const [ad, af] = rank(a);
    const [bd, bf] = rank(b);
    return ad - bd || af - bf;
  })[0]!;
  return best.id;
}

function assertCoord(field: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(
      `${field} out of range`,
      { [field]: [`must be between ${min} and ${max}`] },
      { [field]: value },
      'INVALID_COORDINATES',
    );
  }
}

function haversineKm(a: Coord, b: Coord): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
