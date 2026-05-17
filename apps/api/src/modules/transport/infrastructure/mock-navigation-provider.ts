/**
 * Deterministic synthetic navigation provider. Builds three drawable
 * routes between origin → (waypoints) → destination by bowing the
 * straight line by route-specific perpendicular offsets, so the UI
 * always has a "fastest", a longer "scenic / more adventurous", and a
 * "traffic-avoiding" line to toggle between — with zero network, zero
 * key, and stable geometry (tests assert on it).
 *
 * Speeds: a flat 45 km/h average so duration tracks distance
 * predictably. Real road duration comes from OSRM when reachable;
 * this exists so the feature degrades gracefully and tests are exact.
 *
 * Installed for the live-navigation feature.
 */
import { Injectable } from '@nestjs/common';
import type { NavPoint, NavRouteFlavor, RawNavRoute } from '../domain/nav-route.entity';
import type { NavigationInput, NavigationProvider } from '../application/ports/navigation-provider';

const EARTH_RADIUS_KM = 6371;
const AVG_SPEED_KMH = 45;
const POINTS_PER_HOP = 14;

interface FlavorSpec {
  readonly flavor: NavRouteFlavor;
  readonly label: string;
  /** Perpendicular bow as a fraction of hop length (0 = straight). */
  readonly bow: number;
}

const FLAVORS: readonly FlavorSpec[] = [
  { flavor: 'fastest', label: 'Fastest route', bow: 0.06 },
  { flavor: 'scenic', label: 'Scenic — more adventurous', bow: 0.34 },
  { flavor: 'avoid_traffic', label: 'Traffic-avoiding', bow: -0.18 },
];

@Injectable()
export class MockNavigationProvider implements NavigationProvider {
  async getRoutes(input: NavigationInput): Promise<readonly RawNavRoute[]> {
    const hops: NavPoint[] = [
      { lat: input.originLat, lng: input.originLng },
      ...(input.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: input.destinationLat, lng: input.destinationLng },
    ];

    return FLAVORS.map((spec) => {
      const geometry: NavPoint[] = [];
      let distanceKm = 0;
      for (let h = 1; h < hops.length; h += 1) {
        const a = hops[h - 1]!;
        const b = hops[h]!;
        const seg = bowedSegment(a, b, spec.bow, h === 1);
        geometry.push(...seg);
        for (let i = 1; i < seg.length; i += 1) {
          distanceKm += haversineKm(seg[i - 1]!, seg[i]!);
        }
      }
      const distanceMeters = Math.round(distanceKm * 1000);
      const durationSeconds = Math.round((distanceKm / AVG_SPEED_KMH) * 3600);
      return {
        id: `mock-${spec.flavor}`,
        flavor: spec.flavor,
        label: spec.label,
        distanceMeters,
        durationSeconds,
        geometry,
      } satisfies RawNavRoute;
    });
  }
}

/** Interpolate a→b and push each point off the chord by a sine bow so
 *  the three flavours are visibly distinct lines. `includeStart`
 *  keeps the very first point once across multi-hop joins. */
function bowedSegment(a: NavPoint, b: NavPoint, bow: number, includeStart: boolean): NavPoint[] {
  const out: NavPoint[] = [];
  // Perpendicular unit direction in lat/lng space (good enough at
  // city/region scale for a synthetic line).
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const len = Math.hypot(dLat, dLng) || 1e-9;
  const perpLat = -dLng / len;
  const perpLng = dLat / len;
  for (let i = 0; i <= POINTS_PER_HOP; i += 1) {
    if (i === 0 && !includeStart) continue;
    const t = i / POINTS_PER_HOP;
    const arc = Math.sin(t * Math.PI) * bow * len;
    out.push({
      lat: round6(a.lat + dLat * t + perpLat * arc),
      lng: round6(a.lng + dLng * t + perpLng * arc),
    });
  }
  return out;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function haversineKm(a: NavPoint, b: NavPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
