/**
 * POST.2B.2 — Prisma adapter for trip publications.
 *
 * Installed by prompt [POST.2B.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  // ── POST.2B.3 — pull feed / creator profile (raw SQL: ONE indexed
  //    query each; the "before" cursor is BRANCHED, never a
  //    `$before IS NULL OR ...` filter — that pattern is flaky here).

  async listFeed(
    viewerId: string,
    limit: number,
    before: Date | null,
  ): Promise<readonly TripPublication[]> {
    const visible = Prisma.sql`
      tp."publishedAt" IS NOT NULL
      AND tp.visibility <> 'PRIVATE'
      AND tp."authorId" <> ${viewerId}
      AND (
        tp.visibility = 'PUBLIC'
        OR (tp.visibility = 'FOLLOWERS'
            AND tp."authorId" IN (SELECT "followeeId" FROM "Follow" WHERE "followerId" = ${viewerId}))
      )
      AND NOT EXISTS (
        SELECT 1 FROM "UserBlock" b
        WHERE (b."blockerId" = ${viewerId} AND b."blockedId" = tp."authorId")
           OR (b."blockerId" = tp."authorId" AND b."blockedId" = ${viewerId})
      )`;
    const rows =
      before === null
        ? await this.prisma.$queryRaw<PrismaTripPublication[]>(Prisma.sql`
            SELECT tp.* FROM "TripPublication" tp
            WHERE ${visible}
            ORDER BY tp."publishedAt" DESC LIMIT ${limit}`)
        : await this.prisma.$queryRaw<PrismaTripPublication[]>(Prisma.sql`
            SELECT tp.* FROM "TripPublication" tp
            WHERE ${visible} AND tp."publishedAt" < ${before}
            ORDER BY tp."publishedAt" DESC LIMIT ${limit}`);
    return rows.map(toDomain);
  }

  async listByAuthorVisibleTo(
    authorId: string,
    viewerId: string,
    limit: number,
  ): Promise<readonly TripPublication[]> {
    const rows = await this.prisma.$queryRaw<PrismaTripPublication[]>(Prisma.sql`
      SELECT tp.* FROM "TripPublication" tp
      WHERE tp."authorId" = ${authorId}
        AND tp."publishedAt" IS NOT NULL
        AND tp.visibility <> 'PRIVATE'
        AND (
          tp.visibility = 'PUBLIC'
          OR (tp.visibility = 'FOLLOWERS'
              AND ${authorId} IN (SELECT "followeeId" FROM "Follow" WHERE "followerId" = ${viewerId}))
          OR tp."authorId" = ${viewerId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM "UserBlock" b
          WHERE (b."blockerId" = ${viewerId} AND b."blockedId" = ${authorId})
             OR (b."blockerId" = ${authorId} AND b."blockedId" = ${viewerId})
        )
      ORDER BY tp."publishedAt" DESC LIMIT ${limit}`);
    return rows.map(toDomain);
  }

  async countPublishedByAuthor(authorId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "TripPublication"
      WHERE "authorId" = ${authorId} AND "publishedAt" IS NOT NULL AND visibility <> 'PRIVATE'`);
    return Number(rows[0]?.n ?? 0);
  }

  async countFollowers(authorId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Follow" WHERE "followeeId" = ${authorId}`);
    return Number(rows[0]?.n ?? 0);
  }
}
