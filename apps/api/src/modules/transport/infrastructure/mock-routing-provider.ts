/**
 * Deterministic mock routing provider. Derives every mode's leg
 * from a haversine straight-line distance using mode-specific
 * average speeds + cost rates. Not a real routing algorithm — real
 * adapters will call Google Directions / Mapbox / ORS / GTFS; this
 * mock lights up the endpoint end-to-end + makes tests deterministic.
 *
 * Speed / cost model (intentionally simple; real providers replace
 * this with actual computed legs):
 *
 *   | mode            | speed (km/h) | cost model                  |
 *   |-----------------|--------------|-----------------------------|
 *   | walk            | 5            | free                        |
 *   | bicycle         | 15           | free                        |
 *   | public_transit  | 20           | base 2 USD                  |
 *   | two_wheeler     | 25           | 0.1 × km                    |
 *   | car             | 20 (urban)   | 0.2 × km                    |
 *   | taxi            | 20           | 2 USD base + 1.5 × km       |
 *   | rideshare       | 22           | 2 USD base + 1.7 × km       |
 *
 * Walk is omitted when straight-line > 20 km. Public transit is
 * omitted when > 100 km (inter-city transit needs its own model).
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Injectable } from '@nestjs/common';
import type { RouteLeg, TransportMode } from '../domain/route-leg.entity';
import type { GetRoutesInput, RoutingProvider } from '../application/ports/routing-provider';

const EARTH_RADIUS_KM = 6371;

interface ModeParams {
  readonly speedKmh: number;
  readonly baseUsd: number;
  readonly perKmUsd: number;
  readonly maxKm?: number;
}

const MODE_PARAMS: Record<TransportMode, ModeParams> = {
  walk: { speedKmh: 5, baseUsd: 0, perKmUsd: 0, maxKm: 20 },
  bicycle: { speedKmh: 15, baseUsd: 0, perKmUsd: 0, maxKm: 80 },
  public_transit: { speedKmh: 20, baseUsd: 2, perKmUsd: 0, maxKm: 100 },
  two_wheeler: { speedKmh: 25, baseUsd: 0, perKmUsd: 0.1 },
  car: { speedKmh: 20, baseUsd: 0, perKmUsd: 0.2 },
  taxi: { speedKmh: 20, baseUsd: 2, perKmUsd: 1.5 },
  rideshare: { speedKmh: 22, baseUsd: 2, perKmUsd: 1.7 },
};

@Injectable()
export class MockRoutingProvider implements RoutingProvider {
  async getRoutes(input: GetRoutesInput): Promise<readonly RouteLeg[]> {
    const km = haversineKm(
      { lat: input.originLat, lng: input.originLng },
      { lat: input.destinationLat, lng: input.destinationLng },
    );
    const allModes: readonly TransportMode[] = [
      'walk',
      'bicycle',
      'public_transit',
      'two_wheeler',
      'car',
      'taxi',
      'rideshare',
    ];

    const filter = input.modes && input.modes.length > 0 ? new Set(input.modes) : null;

    const legs: RouteLeg[] = [];
    for (const mode of allModes) {
      if (filter && !filter.has(mode)) continue;
      const params = MODE_PARAMS[mode];
      if (params.maxKm !== undefined && km > params.maxKm) continue;
      // Urban routing overhead: assume the actual route is ~1.3×
      // straight-line (typical urban grid factor). Keeps distance +
      // duration honest vs "great circle, no traffic."
      const distanceMeters = Math.round(km * 1_300);
      const durationSeconds = Math.round((distanceMeters / 1000 / params.speedKmh) * 3600);
      const cost = params.baseUsd + params.perKmUsd * (distanceMeters / 1000);
      const estimatedCostUsd = cost === 0 ? null : round2(cost);
      const stepFree = STEP_FREE_BY_MODE[mode];
      if (input.stepFreeOnly && !stepFree) continue;
      legs.push({
        mode,
        distanceMeters,
        durationSeconds,
        estimatedCostUsd,
        confidence: 'high',
        stepFree,
      });
    }
    return legs;
  }
}

/**
 * V.UX.15 — coarse step-free defaults. `walk` is excluded because
 * sidewalks have curbs/stairs in many places; `public_transit` is
 * excluded because most stations have stairs without lifts. Real
 * adapters source this from accessibility metadata.
 */
const STEP_FREE_BY_MODE: Record<TransportMode, boolean> = {
  walk: false,
  public_transit: false,
  bicycle: true,
  two_wheeler: true,
  car: true,
  taxi: true,
  rideshare: true,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function haversineKm(
  a: { readonly lat: number; readonly lng: number },
  b: { readonly lat: number; readonly lng: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
