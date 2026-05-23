/**
 * Public API of the Trip module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { TripModule } from './trip.module';

export * from './application/ports/itinerary.repository';
export * from './application/ports/trip-media.port';
export * from './application/ports/trip-overview-cache.port';
export * from './application/ports/trip-planner.port';
export * from './application/ports/trip-share.repository';
export * from './application/ports/trip.repository';
