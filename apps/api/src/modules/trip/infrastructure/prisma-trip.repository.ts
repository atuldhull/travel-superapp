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
import type { Prisma } from '@prisma/client';
import type { Trip, TripStatus } from '../domain/trip.entity';
import type {
  AdminTripListInput,
  AdminTripListResult,
  CreateTripDraftInput,
  TripRepository,
  UpdateTripPatch,
} from '../application/ports/trip.repository';

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

  async findById(id: string): Promise<Trip | null> {
    const row = await this.prisma.trip.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listByUser(userId: string, limit: number, archived?: boolean): Promise<readonly Trip[]> {
    const rows = await this.prisma.trip.findMany({
      where: {
        userId,
        ...(archived === undefined
          ? {}
          : archived
            ? { archivedAt: { not: null } }
            : { archivedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map(toDomain);
  }

  async listCollaboratedByUser(userId: string, limit: number): Promise<readonly Trip[]> {
    // V.UX.9: a "collaborator" is any signed-in user who has cast a
    // vote or recorded an expense (paid or in splitShare) on a trip
    // they do NOT own. Trip-share has no per-user membership state,
    // so participation is the proxy.
    const cap = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.trip.findMany({
      where: {
        userId: { not: userId },
        OR: [{ votes: { some: { userId } } }, { expenses: { some: { paidById: userId } } }],
      },
      orderBy: { createdAt: 'desc' },
      take: cap,
    });
    return rows.map(toDomain);
  }

  async updateStatus(id: string, status: TripStatus): Promise<void> {
    await this.prisma.trip.update({
      where: { id },
      data: { status },
    });
  }

  async updateForUser(id: string, userId: string, patch: UpdateTripPatch): Promise<Trip | null> {
    // Two-step: verify ownership via `findFirst`, then update by id.
    // Prisma's updateMany returns count but not the row; update
    // needs a unique-scalar `where` (just id). We gate ownership
    // first to prevent horizontal IDOR.
    const existing = await this.prisma.trip.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const data: {
      title?: string;
      radiusKm?: number;
      startsOn?: Date | null;
      endsOn?: Date | null;
      version?: { increment: number };
    } = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.radiusKm !== undefined) data.radiusKm = patch.radiusKm;
    if ('startsOn' in patch) data.startsOn = patch.startsOn ?? null;
    if ('endsOn' in patch) data.endsOn = patch.endsOn ?? null;
    if (Object.keys(data).length === 0) {
      return toDomain(existing);
    }
    data.version = { increment: 1 };
    const row = await this.prisma.trip.update({ where: { id }, data });
    return toDomain(row);
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    // `deleteMany` returns count — atomic "delete only if owned".
    const result = await this.prisma.trip.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }

  async adminList(input: AdminTripListInput): Promise<AdminTripListResult> {
    const where: Prisma.TripWhereInput = {};
    if (input.status !== undefined) where.status = input.status;
    if (input.q !== undefined && input.q.length > 0) {
      where.title = { contains: input.q, mode: 'insensitive' };
    }
    const [rows, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.trip.count({ where }),
    ]);
    return { rows: rows.map(toDomain), total };
  }

  async adminArchive(id: string): Promise<boolean> {
    // updateMany returns count — `1` for an existing row even if
    // the status was already `archived` (Postgres updates the row
    // but values match). Use `updateMany` so a missing row returns
    // `0` instead of throwing.
    const result = await this.prisma.trip.updateMany({
      where: { id },
      data: { status: 'archived' },
    });
    return result.count === 1;
  }

  async adminDelete(id: string): Promise<boolean> {
    // No owner scope — admin can wipe any trip. Cascades via
    // Prisma onDelete settings.
    const result = await this.prisma.trip.deleteMany({ where: { id } });
    return result.count === 1;
  }

  async setArchivedForUser(id: string, userId: string, archive: boolean): Promise<Trip | null> {
    const result = await this.prisma.trip.updateMany({
      where: { id, userId },
      data: { archivedAt: archive ? new Date() : null },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.trip.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async autoArchiveOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.trip.updateMany({
      where: {
        archivedAt: null,
        createdAt: { lt: cutoff },
      },
      data: { archivedAt: new Date() },
    });
    return result.count;
  }

  async findMostRecentForUser(userId: string): Promise<Trip | null> {
    const row = await this.prisma.trip.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
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
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
