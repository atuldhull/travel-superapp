/**
 * POST.2B.2 — Prisma adapter for trip publications.
 *
 * Installed by prompt [POST.2B.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripPublication as PrismaTripPublication } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { TripPublication, Visibility } from '../domain/trip-publication.entity';
import type {
  TripPublicationRepository,
  UpsertPublishInput,
} from '../application/ports/trip-publication.repository';

function toDomain(row: PrismaTripPublication): TripPublication {
  return {
    id: row.id,
    tripId: row.tripId,
    authorId: row.authorId,
    memoryBookId: row.memoryBookId,
    visibility: row.visibility as Visibility,
    exposedLat: row.exposedLat,
    exposedLng: row.exposedLng,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaTripPublicationRepository implements TripPublicationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsertPublish(input: UpsertPublishInput): Promise<TripPublication> {
    const data = {
      authorId: input.authorId,
      memoryBookId: input.memoryBookId,
      visibility: input.visibility,
      exposedLat: input.exposedLat,
      exposedLng: input.exposedLng,
      publishedAt: input.publishedAt,
    };
    const row = await this.prisma.tripPublication.upsert({
      where: { tripId: input.tripId },
      create: { tripId: input.tripId, ...data },
      update: data,
    });
    return toDomain(row);
  }

  async setPrivate(tripId: string, authorId: string): Promise<void> {
    await this.prisma.tripPublication.updateMany({
      where: { tripId, authorId },
      data: { visibility: 'PRIVATE', exposedLat: null, exposedLng: null, publishedAt: null },
    });
  }

  async findByTrip(tripId: string): Promise<TripPublication | null> {
    const row = await this.prisma.tripPublication.findUnique({ where: { tripId } });
    return row ? toDomain(row) : null;
  }
}
