/**
 * Port for a routing / trip-planner provider. `[IV.18.10.1]` ships a
 * deterministic mock; real adapters (Google Directions, Mapbox,
 * OpenRouteService, GTFS-backed transit) land as sibling classes
 * when credentials + licensing are sorted.
 *
 * `modes` is optional — when absent the provider returns every mode
 * it supports. When present, it's a filter hint (the provider MAY
 * omit modes outside the list; omitting all modes = return empty
 * array).
 *
 * Installed by prompt [IV.18.10.1].
 */
import type { RouteLeg, TransportMode } from '../../domain/route-leg.entity';

export interface GetRoutesInput {
  readonly originLat: number;
  readonly originLng: number;
  readonly destinationLat: number;
  readonly destinationLng: number;
  readonly modes?: readonly TransportMode[];
  /**
   * V.UX.15 — when true, the provider returns only legs whose
   * `stepFree` flag is true. Optional; default behaviour is to
   * return every available leg.
   */
  readonly stepFreeOnly?: boolean;
}

export interface RoutingProvider {
  getRoutes(input: GetRoutesInput): Promise<readonly RouteLeg[]>;
}

export const ROUTING_PROVIDER = Symbol('RoutingProvider');
