/**
 * Public API of the Events module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { EventsModule } from './events.module';

export * from './application/ports/event-cache';
export * from './application/ports/event-provider';

// Public composition surface — Trip orchestrates Events into the
// trip overview composite.
export { SearchEventsUseCase } from './application/search-events.use-case';
export type { EventListing } from './domain/event-listing.entity';
