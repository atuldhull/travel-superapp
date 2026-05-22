/**
 * Port for the trip-overview read-through cache.
 *
 * The interface layer (trip.controller) depends on this; the
 * Redis-backed `TripOverviewCache` (infrastructure) implements it.
 * Keeps the controller free of a direct infrastructure import
 * (CLAUDE.md #10).
 *
 * Extracted by prompt [A1-burndown].
 */
export interface TripOverviewCachePort {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

/** Nest DI token. */
export const TRIP_OVERVIEW_CACHE_PORT = Symbol('TripOverviewCachePort');

/** Cache TTL — short, since an overview composes 7 live sub-fetches.
 *  Lives on the port (not the infra file) so the controller can read
 *  it without an interface→infrastructure import. */
export const TRIP_OVERVIEW_CACHE_TTL_SEC = 60;
