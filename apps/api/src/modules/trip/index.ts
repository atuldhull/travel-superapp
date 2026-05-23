/**
 * Public API of the Trip module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `TripModule` —
 * cross-module DI imports use `./trip.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/itinerary.repository';
export * from './application/ports/trip-media.port';
export * from './application/ports/trip-overview-cache.port';
export * from './application/ports/trip-planner.port';
export * from './application/ports/trip-share.repository';
export * from './application/ports/trip.repository';

// Public domain types — entity shape + event payloads consumed
// across the modular monolith. Feed reads `Trip` to compose
// publication snapshots; notifications + agent handlers read the
// event payloads off the bus. `makeEvent` stays private.
export type { Trip, TripStatus } from './domain/trip.entity';
export type {
  TripDeletedEvent,
  TripDeletedPayload,
  TripDraftedEvent,
  TripDraftedPayload,
  TripItineraryGeneratedEvent,
  TripItineraryGeneratedPayload,
  TripLockedEvent,
  TripLockedPayload,
  TripUpdatedEvent,
  TripUpdatedPayload,
} from './domain/trip.events';

// Public use-cases — identity's onboarding "skip + seed sample"
// flow consumes `SeedSampleTripUseCase` directly. Exposing it on
// the barrel is intentional; sample-seeding is a Trip-public
// concern, not an internal one.
export { SeedSampleTripUseCase } from './application/seed-sample-trip.use-case';
