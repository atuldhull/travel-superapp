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
  SimilarTrip,
  SuggestedTraveller,
} from '../application/ports/trip-publication.repository';
import { assertEmbeddingDimension } from '../application/ports/embedding.port';

/** pgvector accepts `[v1,v2,...]::vector`. Mirrors
 *  `VectorQueries.toVectorLiteral` for index/op-class consistency. */
function toVectorLiteral(vec: readonly number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * POST.2C.2 — explicit projection. NEVER `SELECT tp.*` on
 * "TripPublication": the additive `embedding vector(1024)` column is
 * `Unsupported()` and `$queryRaw` cannot deserialize the pgvector
 * `vector` type ("Failed to deserialize column of type 'vector'"),
 * so `tp.*` throws. These are exactly the columns `toDomain` maps —
 * embedding is intentionally excluded (read it via VectorQueries-style
 * raw casts only, never through the row mapper).
 */
const TP_COLS = Prisma.sql`tp."id", tp."tripId", tp."authorId", tp."memoryBookId", tp."visibility", tp."exposedLat", tp."exposedLng", tp."publishedAt", tp."createdAt", tp."updatedAt"`;

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
    // POST.2C.2 — ONE statement: the visibility flip AND the embedding
    // de-index are atomic by construction (a single UPDATE is its own
    // implicit transaction). `embedding = NULL` lives here — not a
    // second call — so discovery / agent grounding can never read a
    // ghost vector for an unpublished trip. Raw SQL because the typed
    // client cannot express the `Unsupported("vector(1024)")` column.
    await this.prisma.$executeRaw`
      UPDATE "TripPublication"
      SET visibility = 'PRIVATE',
          "exposedLat" = NULL,
          "exposedLng" = NULL,
          "publishedAt" = NULL,
          embedding = NULL,
          "updatedAt" = NOW()
      WHERE "tripId" = ${tripId} AND "authorId" = ${authorId}`;
  }

  async setEmbedding(tripId: string, authorId: string, embedding: number[] | null): Promise<void> {
    // Best-effort skip-index: a transient Ollama outage must NOT wipe a
    // previously-good vector, so `null` is a deliberate no-op.
    if (embedding === null) {
      return;
    }
    // Hard guard BEFORE any DB write — a non-1024 vector is a model
    // misconfig defect, never silently written (it would corrupt the
    // ivfflat index / break L2 search). Throws loudly.
    assertEmbeddingDimension(embedding);
    const vecLiteral = toVectorLiteral(embedding);
    await this.prisma.$executeRaw`
      UPDATE "TripPublication"
      SET embedding = ${vecLiteral}::vector, "updatedAt" = NOW()
      WHERE "tripId" = ${tripId} AND "authorId" = ${authorId}`;
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
            SELECT ${TP_COLS} FROM "TripPublication" tp
            WHERE ${visible}
            ORDER BY tp."publishedAt" DESC LIMIT ${limit}`)
        : await this.prisma.$queryRaw<PrismaTripPublication[]>(Prisma.sql`
            SELECT ${TP_COLS} FROM "TripPublication" tp
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
      SELECT ${TP_COLS} FROM "TripPublication" tp
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

  // ── POST.2C.3 — pgvector "trips like this" / agent grounding.
  //    The visibility + block predicate is the SAME security model as
  //    listFeed (PRIVATE never; FOLLOWERS only if followed; either-
  //    direction block excluded; viewer's own excluded) — LAW 2 says
  //    these reads must NEVER surface content the viewer can't see.
  //    Built once here so the rail and the grounding cannot drift.

  private similarSecurityPredicate(viewerId: string): Prisma.Sql {
    return Prisma.sql`
      tp."publishedAt" IS NOT NULL
      AND tp.visibility <> 'PRIVATE'
      AND tp.embedding IS NOT NULL
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
  }

  async findSimilarByVector(
    embedding: number[],
    viewerId: string,
    limit: number,
  ): Promise<readonly SimilarTrip[]> {
    // Guard BEFORE the DB (a non-1024 query vector is a hard bug —
    // same rule as the write path; would also misuse the ivfflat op).
    assertEmbeddingDimension(embedding);
    const vec = toVectorLiteral(embedding);
    const rows = await this.prisma.$queryRaw<SimilarTrip[]>(Prisma.sql`
      SELECT tp."tripId", t."title", tp."authorId",
             (tp.embedding <-> ${vec}::vector)::double precision AS distance
      FROM "TripPublication" tp
      JOIN "Trip" t ON t.id = tp."tripId"
      WHERE ${this.similarSecurityPredicate(viewerId)}
      ORDER BY tp.embedding <-> ${vec}::vector
      LIMIT ${limit}`);
    return rows;
  }

  async listSuggestedTravellers(
    viewerId: string,
    limit: number,
  ): Promise<readonly SuggestedTraveller[]> {
    // ONE grouped query. Discovery only ever surfaces PUBLIC trips —
    // FOLLOWERS-only authors stay private to non-followers (LAW 2),
    // and a FOLLOWERS author wouldn't be a useful "discover" hit
    // anyway. Excludes the viewer, anyone they already follow,
    // blocked pairs (either direction), and soft-deleted users.
    const rows = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        displayName: string;
        publishedCount: bigint;
      }>
    >(Prisma.sql`
      SELECT tp."authorId" AS "userId",
             u."displayName" AS "displayName",
             COUNT(*)::bigint AS "publishedCount"
      FROM "TripPublication" tp
      JOIN "User" u ON u.id = tp."authorId" AND u."deletedAt" IS NULL
      WHERE tp."publishedAt" IS NOT NULL
        AND tp.visibility = 'PUBLIC'
        AND tp."authorId" <> ${viewerId}
        AND tp."authorId" NOT IN (
          SELECT "followeeId" FROM "Follow" WHERE "followerId" = ${viewerId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM "UserBlock" b
          WHERE (b."blockerId" = ${viewerId} AND b."blockedId" = tp."authorId")
             OR (b."blockerId" = tp."authorId" AND b."blockedId" = ${viewerId})
        )
      GROUP BY tp."authorId", u."displayName"
      ORDER BY "publishedCount" DESC, u."displayName" ASC
      LIMIT ${limit}`);
    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      publishedCount: Number(r.publishedCount),
    }));
  }

  async findSimilarToPublication(
    sourceTripId: string,
    viewerId: string,
    limit: number,
  ): Promise<readonly SimilarTrip[]> {
    // The query vector is the source trip's own embedding, fetched in
    // SQL (no JS round-trip). If it's NULL (or the trip doesn't
    // exist) `src.e IS NOT NULL` zeroes the result → empty rail, no
    // crash (LAW 1). Source trip itself is excluded.
    const rows = await this.prisma.$queryRaw<SimilarTrip[]>(Prisma.sql`
      SELECT tp."tripId", t."title", tp."authorId",
             (tp.embedding <-> src.e)::double precision AS distance
      FROM "TripPublication" tp
      JOIN "Trip" t ON t.id = tp."tripId"
      CROSS JOIN (
        SELECT embedding AS e FROM "TripPublication" WHERE "tripId" = ${sourceTripId}
      ) src
      WHERE src.e IS NOT NULL
        AND tp."tripId" <> ${sourceTripId}
        AND ${this.similarSecurityPredicate(viewerId)}
      ORDER BY tp.embedding <-> src.e
      LIMIT ${limit}`);
    return rows;
  }
}
