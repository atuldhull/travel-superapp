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
import { SearchPlacesUseCase } from './application/search-places.use-case';
import { PLACE_REPOSITORY } from './application/ports/place.repository';
import { PrismaPlaceRepository } from './infrastructure/prisma-place.repository';
import { PlacesController } from './interface/places.controller';

@Module({
  controllers: [PlacesController],
  providers: [{ provide: PLACE_REPOSITORY, useClass: PrismaPlaceRepository }, SearchPlacesUseCase],
  exports: [PLACE_REPOSITORY],
})
export class PlacesModule {}
