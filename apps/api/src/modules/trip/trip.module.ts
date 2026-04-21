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
import { FoodModule } from '../food/food.module';
import { PlacesModule } from '../places/places.module';
import { StaysModule } from '../stays/stays.module';
import { WeatherModule } from '../weather/weather.module';
import { CreateTripDraftUseCase } from './application/create-trip-draft.use-case';
import { CreateTripShareUseCase } from './application/create-trip-share.use-case';
import { ListTripSharesUseCase } from './application/list-trip-shares.use-case';
import { DeleteTripUseCase } from './application/delete-trip.use-case';
import { GenerateItineraryStubUseCase } from './application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from './application/get-trip.use-case';
import { GetTripEateriesUseCase } from './application/get-trip-eateries.use-case';
import { GetTripStaysUseCase } from './application/get-trip-stays.use-case';
import { GetTripWeatherUseCase } from './application/get-trip-weather.use-case';
import { ListItineraryUseCase } from './application/list-itinerary.use-case';
import { ListTripsUseCase } from './application/list-trips.use-case';
import { ITINERARY_REPOSITORY } from './application/ports/itinerary.repository';
import { TRIP_REPOSITORY } from './application/ports/trip.repository';
import { TRIP_SHARE_REPOSITORY } from './application/ports/trip-share.repository';
import { ResolveTripShareUseCase } from './application/resolve-trip-share.use-case';
import { RevokeTripShareUseCase } from './application/revoke-trip-share.use-case';
import { UpdateDayItemsUseCase } from './application/update-day-items.use-case';
import { UpdateTripUseCase } from './application/update-trip.use-case';
import { PrismaItineraryRepository } from './infrastructure/prisma-itinerary.repository';
import { PrismaTripRepository } from './infrastructure/prisma-trip.repository';
import { PrismaTripShareRepository } from './infrastructure/prisma-trip-share.repository';
import { TripController } from './interface/trip.controller';

@Module({
  // Import sibling modules so Trip's fold-in use-cases can reuse
  // each module's own use-case (PLACE_REPOSITORY for itinerary,
  // GetForecastUseCase / SearchStaysUseCase / SearchEateriesUseCase
  // for the Trip × * overlays). All one-way deps — none of those
  // modules knows about Trip.
  imports: [PlacesModule, WeatherModule, StaysModule, FoodModule],
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
    RevokeTripShareUseCase,
    ListTripSharesUseCase,
    GetTripWeatherUseCase,
    GetTripStaysUseCase,
    GetTripEateriesUseCase,
  ],
  exports: [TRIP_REPOSITORY, ITINERARY_REPOSITORY, TRIP_SHARE_REPOSITORY],
})
export class TripModule {}
