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
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { EventsModule } from '../events';
import { FoodModule } from '../food';
import { MediaModule } from '../media';
import { PlacesModule } from '../places';
import { SafetyModule } from '../safety';
import { StaysModule } from '../stays';
import { TransportModule } from '../transport';
import { WeatherModule } from '../weather';
import { AdminArchiveTripUseCase } from './application/admin-archive-trip.use-case';
import { AdminDeleteTripUseCase } from './application/admin-delete-trip.use-case';
import { AdminListTripsUseCase } from './application/admin-list-trips.use-case';
import { ArchiveTripUseCase } from './application/archive-trip.use-case';
import { AutoArchiveOldTripsUseCase } from './application/auto-archive-old-trips.use-case';
import { CreateTripDraftUseCase } from './application/create-trip-draft.use-case';
import { SuggestFromHistoryUseCase } from './application/suggest-from-history.use-case';
import { CreateTripShareUseCase } from './application/create-trip-share.use-case';
import { ListTripSharesUseCase } from './application/list-trip-shares.use-case';
import { DeleteTripUseCase } from './application/delete-trip.use-case';
import { DuplicateTripUseCase } from './application/duplicate-trip.use-case';
import { OptimizeDayRouteUseCase } from './application/optimize-day-route.use-case';
import { GetDayRouteCoordsUseCase } from './application/get-day-route-coords.use-case';
import { NearMeNowUseCase } from './application/near-me-now.use-case';
import { LockTripUseCase, UnlockTripUseCase } from './application/lock-trip.use-case';
import { GetTripWithRoleUseCase } from './application/get-trip-with-role.use-case';
import { CloneSharedTripUseCase } from './application/clone-shared-trip.use-case';
import { GenerateItineraryStubUseCase } from './application/generate-itinerary-stub.use-case';
import { SeedSampleTripUseCase } from './application/seed-sample-trip.use-case';
import { GeneratePlanWithAiUseCase } from './application/generate-plan-with-ai.use-case';
import { GenerateSamplePlanUseCase } from './application/generate-sample-plan.use-case';
import { GetTripUseCase } from './application/get-trip.use-case';
import { GetTripEateriesUseCase } from './application/get-trip-eateries.use-case';
import { GetTripEventsUseCase } from './application/get-trip-events.use-case';
import { GetTripOverviewUseCase } from './application/get-trip-overview.use-case';
import { GetTripStaysUseCase } from './application/get-trip-stays.use-case';
import { GetTripTransportLegsUseCase } from './application/get-trip-transport-legs.use-case';
import { GetTripCenterUseCase } from './application/get-trip-center.use-case';
import { SetItemCompletedUseCase } from './application/set-item-completed.use-case';
import { ShiftItineraryDatesUseCase } from './application/shift-itinerary-dates.use-case';
import { GetTripWeatherUseCase } from './application/get-trip-weather.use-case';
import { ListItineraryUseCase } from './application/list-itinerary.use-case';
import { ListTripsUseCase } from './application/list-trips.use-case';
import { ITINERARY_REPOSITORY } from './application/ports/itinerary.repository';
import { TRIP_PLANNER_PORT } from './application/ports/trip-planner.port';
import { TRIP_REPOSITORY } from './application/ports/trip.repository';
import { TRIP_SHARE_REPOSITORY } from './application/ports/trip-share.repository';
import { ResolveTripShareUseCase } from './application/resolve-trip-share.use-case';
import { RevokeTripShareUseCase } from './application/revoke-trip-share.use-case';
import { SuggestPlacesForTripUseCase } from './application/suggest-places-for-trip.use-case';
import { UpdateDayItemsUseCase } from './application/update-day-items.use-case';
import { UpdateTripUseCase } from './application/update-trip.use-case';
import { ClaudeTripPlannerAdapter } from './infrastructure/claude-trip-planner.adapter';
import { GeminiTripPlannerAdapter } from './infrastructure/gemini-trip-planner.adapter';
import { OllamaTripPlannerAdapter } from './infrastructure/ollama-trip-planner.adapter';
import { PrismaItineraryRepository } from './infrastructure/prisma-itinerary.repository';
import { PrismaTripRepository } from './infrastructure/prisma-trip.repository';
import { PrismaTripShareRepository } from './infrastructure/prisma-trip-share.repository';
import { StubTripPlannerAdapter } from './infrastructure/stub-trip-planner.adapter';
import { TripOverviewCache } from './infrastructure/trip-overview-cache';
import { TRIP_OVERVIEW_CACHE_PORT } from './application/ports/trip-overview-cache.port';
import { AdminTripsController } from './interface/admin-trips.controller';
import { AutoArchiveTripsScheduler } from './interface/auto-archive-trips.scheduler';
import { NearMeController } from './interface/near-me.controller';
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
    // V.UX.20 — FoodModule now imports TripModule (forwardRef) so the
    // food-crawl builder can owner-gate by trip. Both sides must use
    // forwardRef to break the cycle.
    forwardRef(() => FoodModule),
    EventsModule,
    TransportModule,
    SafetyModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [TripController, AdminTripsController, NearMeController],
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
    GeneratePlanWithAiUseCase,
    GenerateSamplePlanUseCase,
    SeedSampleTripUseCase,
    {
      // POST.4 — 4-tier provider chain, evaluated at boot in priority
      // order:
      //   1. Anthropic Claude    (paid, premium)            → ANTHROPIC_API_KEY
      //   2. Google Gemini Flash (free tier, 1500 req/day)  → GEMINI_API_KEY
      //   3. Ollama (local LLM)  (truly $0, runs offline)   → OLLAMA_URL
      //   4. StubTripPlannerAdapter                         (always)
      //
      // Callers depend only on the TRIP_PLANNER_PORT symbol — see
      // ADR (port + adapter pattern) — so adding a fifth provider is
      // a one-file change here. The condition-throwing adapters
      // (Claude / Gemini / Ollama) are intentionally NOT in the
      // providers[] array — Nest would eagerly instantiate them and
      // their ctors require keys/URLs that may be absent.
      provide: TRIP_PLANNER_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const anthropicKey = config.get('ANTHROPIC_API_KEY', { infer: true });
        if (anthropicKey) {
          const model = config.get('ANTHROPIC_MODEL', { infer: true });
          return new ClaudeTripPlannerAdapter(anthropicKey, model);
        }
        const geminiKey = config.get('GEMINI_API_KEY', { infer: true });
        if (geminiKey) {
          const model = config.get('GEMINI_MODEL', { infer: true });
          return new GeminiTripPlannerAdapter(geminiKey, model);
        }
        const ollamaUrl = config.get('OLLAMA_URL', { infer: true });
        if (ollamaUrl) {
          const model = config.get('OLLAMA_MODEL', { infer: true });
          return new OllamaTripPlannerAdapter(ollamaUrl, model);
        }
        return new StubTripPlannerAdapter();
      },
    },
    ListItineraryUseCase,
    UpdateDayItemsUseCase,
    CreateTripShareUseCase,
    ResolveTripShareUseCase,
    RevokeTripShareUseCase,
    ListTripSharesUseCase,
    GetTripCenterUseCase,
    SetItemCompletedUseCase,
    ShiftItineraryDatesUseCase,
    GetTripWeatherUseCase,
    GetTripStaysUseCase,
    GetTripEateriesUseCase,
    GetTripEventsUseCase,
    GetTripTransportLegsUseCase,
    GetTripOverviewUseCase,
    SuggestPlacesForTripUseCase,
    DuplicateTripUseCase,
    OptimizeDayRouteUseCase,
    GetDayRouteCoordsUseCase,
    NearMeNowUseCase,
    LockTripUseCase,
    UnlockTripUseCase,
    GetTripWithRoleUseCase,
    CloneSharedTripUseCase,
    { provide: TRIP_OVERVIEW_CACHE_PORT, useClass: TripOverviewCache },
    AdminListTripsUseCase,
    AdminArchiveTripUseCase,
    AdminDeleteTripUseCase,
    ArchiveTripUseCase,
    AutoArchiveOldTripsUseCase,
    SuggestFromHistoryUseCase,
    AutoArchiveTripsScheduler,
  ],
  // POST.2A.4 — TRIP_PLANNER_PORT exported so the 2.0 agent can
  // reuse the existing 4-tier planner as a tool (no new LLM
  // plumbing). Additive, non-breaking.
  exports: [
    TRIP_REPOSITORY,
    ITINERARY_REPOSITORY,
    TRIP_SHARE_REPOSITORY,
    SeedSampleTripUseCase,
    TRIP_PLANNER_PORT,
  ],
})
export class TripModule {}
