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
import { forwardRef, Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { FoodModule } from '../food/food.module';
import { MediaModule } from '../media/media.module';
import { PlacesModule } from '../places/places.module';
import { StaysModule } from '../stays/stays.module';
import { TransportModule } from '../transport/transport.module';
import { WeatherModule } from '../weather/weather.module';
import { AdminArchiveTripUseCase } from './application/admin-archive-trip.use-case';
import { AdminDeleteTripUseCase } from './application/admin-delete-trip.use-case';
import { AdminListTripsUseCase } from './application/admin-list-trips.use-case';
import { CreateTripDraftUseCase } from './application/create-trip-draft.use-case';
import { CreateTripShareUseCase } from './application/create-trip-share.use-case';
import { ListTripSharesUseCase } from './application/list-trip-shares.use-case';
import { DeleteTripUseCase } from './application/delete-trip.use-case';
import { GenerateItineraryStubUseCase } from './application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from './application/get-trip.use-case';
import { GetTripEateriesUseCase } from './application/get-trip-eateries.use-case';
import { GetTripEventsUseCase } from './application/get-trip-events.use-case';
import { GetTripOverviewUseCase } from './application/get-trip-overview.use-case';
import { GetTripStaysUseCase } from './application/get-trip-stays.use-case';
import { GetTripTransportLegsUseCase } from './application/get-trip-transport-legs.use-case';
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
import { AdminTripsController } from './interface/admin-trips.controller';
import { TripController } from './interface/trip.controller';

@Module({
  // Import sibling modules so Trip's fold-in use-cases can reuse
  // each module's own use-case (PLACE_REPOSITORY for itinerary,
  // GetForecastUseCase / SearchStaysUseCase / SearchEateriesUseCase
  // for the Trip × * overlays). All one-way deps — none of those
  // modules knows about Trip.
  // `forwardRef(() => MediaModule)` breaks the Trip↔Media circular
  // dependency: Media imports Trip for the trip-attach owner gate
  // (existing); Trip now imports Media so the overview use-case
  // can fold a `media` section via `TRIP_MEDIA_PORT`. Both sides
  // use `forwardRef` — Nest's documented pattern.
  // Installed in [IV.18.12.10].
  imports: [
    PlacesModule,
    WeatherModule,
    StaysModule,
    FoodModule,
    EventsModule,
    TransportModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [TripController, AdminTripsController],
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
    GetTripEventsUseCase,
    GetTripTransportLegsUseCase,
    GetTripOverviewUseCase,
    AdminListTripsUseCase,
    AdminArchiveTripUseCase,
    AdminDeleteTripUseCase,
  ],
  exports: [TRIP_REPOSITORY, ITINERARY_REPOSITORY, TRIP_SHARE_REPOSITORY],
})
export class TripModule {}
