/**
 * Public API of the Places module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { PlacesModule } from './places.module';

export * from './application/ports/place-provider';
export * from './application/ports/place-search-cache';
export * from './application/ports/place.repository';

// Public domain types — admin place-curation flows read `Place`
// for response shapes; trip orchestrators read `PlaceWithDistance`
// for nearby queries.
export type { Place, PlaceWithDistance } from './domain/place.entity';

// Public composition surface — Trip orchestrates Places for
// near-me-now + the federated place-suggestion / ingestion flow
// used during plan generation.
export { FederatedSearchPlacesUseCase } from './application/federated-search-places.use-case';
export { IngestFederatedResultsUseCase } from './application/ingest-federated-results.use-case';
export { SearchPlacesUseCase } from './application/search-places.use-case';
