/**
 * Public API of the Events module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `EventsModule` —
 * cross-module DI imports use `./events.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/event-cache';
export * from './application/ports/event-provider';

// Public composition surface — Trip orchestrates Events into the
// trip overview composite.
export { SearchEventsUseCase } from './application/search-events.use-case';
export type { EventListing } from './domain/event-listing.entity';
