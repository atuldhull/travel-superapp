/**
 * Public API of the Food module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { FoodModule } from './food.module';

export * from './application/ports/eatery-cache';
export * from './application/ports/eatery-provider';

// Public composition surface — Trip orchestrates Food into the
// `/api/v1/trips/:id/overview` composite. The use-case + its result
// type are the legitimate public surface.
export { SearchEateriesUseCase } from './application/search-eateries.use-case';
export type { EateryListing } from './domain/eatery-listing.entity';
