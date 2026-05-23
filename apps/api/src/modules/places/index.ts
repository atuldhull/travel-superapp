/**
 * Public API of the Places module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `PlacesModule` —
 * cross-module DI imports use `./places.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

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
