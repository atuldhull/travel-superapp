/**
 * Public API of the Stays module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `StaysModule` —
 * cross-module DI imports use `./stays.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/stay-cache';
export * from './application/ports/stay-provider';

// Public composition surface — Trip orchestrates Stays into the
// trip overview composite.
export { SearchStaysUseCase } from './application/search-stays.use-case';
export type { StayListing } from './domain/stay-listing.entity';
