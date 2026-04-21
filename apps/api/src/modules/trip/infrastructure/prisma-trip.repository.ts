/**
 * Prisma + GeoQueries adapter for `TripRepository`. Writes go via
 * `GeoQueries.insertTrip` (raw SQL for the PostGIS `center` column);
 * reads go through Prisma's generated delegate — `center` is omitted
 * from the returned type because it's `Unsupported` in the schema.
 *
 * Installed by prompt [IV.18.2.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Trip as PrismaTrip } from '@prisma/client';
import { GeoQueries } from '../../../common/db/geo-queries';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Trip, TripStatus } from '../domain/trip.entity';
import type { CreateTripDraftInput, TripRepository } from '../application/ports/trip.repository';

@Injectable()
export class PrismaTripRepository implements TripRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async createDraft(input: CreateTripDraftInput): Promise<Trip> {
    const row = await this.geo.insertTrip({
      userId: input.userId,
      title: input.title,
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      status: 'draft',
      startsOn: input.startsOn ?? null,
      endsOn: input.endsOn ?? null,
    });
    return toDomain(row);
  }

  async findByIdForUser(id: string, userId: string): Promise<Trip | null> {
    const row = await this.prisma.trip.findFirst({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async listByUser(userId: string, limit: number): Promise<readonly Trip[]> {
    const rows = await this.prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map(toDomain);
  }

  async updateStatus(id: string, status: TripStatus): Promise<void> {
    await this.prisma.trip.update({
      where: { id },
      data: { status },
    });
  }
}

function toDomain(row: PrismaTrip): Trip {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    status: row.status as TripStatus,
    radiusKm: row.radiusKm,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
