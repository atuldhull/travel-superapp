/**
 * Places feature module. Clean-hex layering:
 *
 *   controller (interface)
 *     → SearchPlacesUseCase (application)
 *       → PlaceRepository port (application)
 *         ← PrismaPlaceRepository (infrastructure) delegating to
 *           the global `GeoQueries` raw-SQL layer.
 *
 * `GeoQueries` is provided by the `DbModule` (@Global), so no import
 * is needed here.
 *
 * Installed by prompt [IV.18.2.9].
 */
import { Module } from '@nestjs/common';
import { FederatedSearchPlacesUseCase } from './application/federated-search-places.use-case';
import { IngestFederatedResultsUseCase } from './application/ingest-federated-results.use-case';
import { SearchPlacesUseCase } from './application/search-places.use-case';
import { PLACE_PROVIDER } from './application/ports/place-provider';
import { PLACE_SEARCH_CACHE } from './application/ports/place-search-cache';
import { PLACE_REPOSITORY } from './application/ports/place.repository';
import { CachedPlaceProvider } from './infrastructure/cached-place-provider';
import { MockPlaceProvider } from './infrastructure/mock-place-provider';
import { PrismaPlaceRepository } from './infrastructure/prisma-place.repository';
import { RedisPlaceSearchCache } from './infrastructure/redis-place-search-cache';
import { PlacesController } from './interface/places.controller';

@Module({
  controllers: [PlacesController],
  providers: [
    { provide: PLACE_REPOSITORY, useClass: PrismaPlaceRepository },
    SearchPlacesUseCase,
    // Federated search chain: PLACE_PROVIDER → CachedPlaceProvider
    // wraps MockPlaceProvider + PLACE_SEARCH_CACHE
    // (RedisPlaceSearchCache). MockPlaceProvider registered as its
    // own class token so the decorator can @Inject it by class
    // without self-resolving against the port symbol.
    MockPlaceProvider,
    { provide: PLACE_SEARCH_CACHE, useClass: RedisPlaceSearchCache },
    { provide: PLACE_PROVIDER, useClass: CachedPlaceProvider },
    FederatedSearchPlacesUseCase,
    IngestFederatedResultsUseCase,
  ],
  exports: [
    PLACE_REPOSITORY,
    PLACE_PROVIDER,
    FederatedSearchPlacesUseCase,
    IngestFederatedResultsUseCase,
  ],
})
export class PlacesModule {}
