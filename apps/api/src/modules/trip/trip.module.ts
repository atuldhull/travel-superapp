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
import { GetTripUseCase } from './application/get-trip.use-case';
import { ListTripsUseCase } from './application/list-trips.use-case';
import { TRIP_REPOSITORY } from './application/ports/trip.repository';
import { PrismaTripRepository } from './infrastructure/prisma-trip.repository';
import { TripController } from './interface/trip.controller';

@Module({
  controllers: [TripController],
  providers: [
    { provide: TRIP_REPOSITORY, useClass: PrismaTripRepository },
    CreateTripDraftUseCase,
    ListTripsUseCase,
    GetTripUseCase,
  ],
  exports: [TRIP_REPOSITORY],
})
export class TripModule {}
