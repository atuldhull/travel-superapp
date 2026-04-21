/**
 * Trip feature module. Clean-hex DI:
 *
 *   controller (interface)
 *     → use-cases (application)
 *       → port (application)
 *         ← Prisma adapter (infrastructure)
 *
 * The adapter depends on `PrismaService` (from the global DbModule)
 * and `GeoQueries` (raw-SQL seam for the PostGIS `center` column,
 * CLAUDE rule 11).
 *
 * Installed by prompt [IV.18.2.3].
 */
import { Module } from '@nestjs/common';
import { CreateTripDraftUseCase } from './application/create-trip-draft.use-case';
import { GenerateItineraryStubUseCase } from './application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from './application/get-trip.use-case';
import { ListItineraryUseCase } from './application/list-itinerary.use-case';
import { ListTripsUseCase } from './application/list-trips.use-case';
import { ITINERARY_REPOSITORY } from './application/ports/itinerary.repository';
import { TRIP_REPOSITORY } from './application/ports/trip.repository';
import { PrismaItineraryRepository } from './infrastructure/prisma-itinerary.repository';
import { PrismaTripRepository } from './infrastructure/prisma-trip.repository';
import { TripController } from './interface/trip.controller';

@Module({
  controllers: [TripController],
  providers: [
    { provide: TRIP_REPOSITORY, useClass: PrismaTripRepository },
    { provide: ITINERARY_REPOSITORY, useClass: PrismaItineraryRepository },
    CreateTripDraftUseCase,
    ListTripsUseCase,
    GetTripUseCase,
    GenerateItineraryStubUseCase,
    ListItineraryUseCase,
  ],
  exports: [TRIP_REPOSITORY, ITINERARY_REPOSITORY],
})
export class TripModule {}
