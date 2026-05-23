/**
 * Public API of the Food module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `FoodModule` —
 * cross-module DI imports use `./food.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/eatery-cache';
export * from './application/ports/eatery-provider';

// Public composition surface — Trip orchestrates Food into the
// `/api/v1/trips/:id/overview` composite. The use-case + its result
// type are the legitimate public surface.
export { SearchEateriesUseCase } from './application/search-eateries.use-case';
export type { EateryListing } from './domain/eatery-listing.entity';
