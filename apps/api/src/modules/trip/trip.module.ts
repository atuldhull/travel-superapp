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
import { PlacesModule } from '../places/places.module';
import { CreateTripDraftUseCase } from './application/create-trip-draft.use-case';
import { CreateTripShareUseCase } from './application/create-trip-share.use-case';
import { DeleteTripUseCase } from './application/delete-trip.use-case';
import { GenerateItineraryStubUseCase } from './application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from './application/get-trip.use-case';
import { ListItineraryUseCase } from './application/list-itinerary.use-case';
import { ListTripsUseCase } from './application/list-trips.use-case';
import { ITINERARY_REPOSITORY } from './application/ports/itinerary.repository';
import { TRIP_REPOSITORY } from './application/ports/trip.repository';
import { TRIP_SHARE_REPOSITORY } from './application/ports/trip-share.repository';
import { ResolveTripShareUseCase } from './application/resolve-trip-share.use-case';
import { UpdateDayItemsUseCase } from './application/update-day-items.use-case';
import { UpdateTripUseCase } from './application/update-trip.use-case';
import { PrismaItineraryRepository } from './infrastructure/prisma-itinerary.repository';
import { PrismaTripRepository } from './infrastructure/prisma-trip.repository';
import { PrismaTripShareRepository } from './infrastructure/prisma-trip-share.repository';
import { TripController } from './interface/trip.controller';

@Module({
  // Import PlacesModule so GenerateItineraryStubUseCase can inject
  // the PLACE_REPOSITORY port (Places exports it). Keeps the
  // cross-module dependency explicit + traceable. Trip depends on
  // Places, not the other way around — Places has no knowledge of
  // trips.
  imports: [PlacesModule],
  controllers: [TripController],
  providers: [
    { provide: TRIP_REPOSITORY, useClass: PrismaTripRepository },
    { provide: ITINERARY_REPOSITORY, useClass: PrismaItineraryRepository },
    { provide: TRIP_SHARE_REPOSITORY, useClass: PrismaTripShareRepository },
    CreateTripDraftUseCase,
    ListTripsUseCase,
    GetTripUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    GenerateItineraryStubUseCase,
    ListItineraryUseCase,
    UpdateDayItemsUseCase,
    CreateTripShareUseCase,
    ResolveTripShareUseCase,
  ],
  exports: [TRIP_REPOSITORY, ITINERARY_REPOSITORY, TRIP_SHARE_REPOSITORY],
})
export class TripModule {}
