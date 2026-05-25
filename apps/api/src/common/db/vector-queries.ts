import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from './prisma.service';

/**
 * pgvector-aware DB access for `PlaceEmbedding.embedding`.
 *
 * Prisma can't type `Unsupported("vector(1024)")` — all writes + reads
 * go through `$executeRaw` / `$queryRaw` with explicit `::vector`
 * casts. L2 distance via the `<->` operator ([ADR-007 §vectors]).
 *
 * Index strategy: IVFFlat with `lists = 100` (good for ~100k–1M rows).
 * Switch to HNSW when ANY of the following holds over a rolling 14-day
 * window (superseding ADR required, per [ADR-007]):
 *   1. Row count > 1,000,000, OR
 *   2. recall@10 drops below 0.95 on a known eval set, OR
 *   3. IVFFlat re-train takes longer than 1 hour.
 *
 * Installed by prompt [III.12.3].
 */
const EXPECTED_DIMENSIONS = 1024;
const DEFAULT_MODEL = 'unknown';

@Injectable()
export class VectorQueries {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Upsert an embedding for a given Place row. The `PlaceEmbedding`
   * table is keyed by `placeId` (1:1 with `Place`), so conflicts update
   * in-place.
   *
   * Throws if the vector length doesn't match the schema's dimension.
   */
  async upsertEmbedding(
    placeId: string,
    embedding: number[],
    model = DEFAULT_MODEL,
  ): Promise<void> {
    assertDimension(embedding);
    const vecLiteral = toVectorLiteral(embedding);
    const now = this.clock.now();
    await this.prisma.$executeRaw`
      INSERT INTO "PlaceEmbedding" ("placeId", model, embedding, "updatedAt")
      VALUES (${placeId}, ${model}, ${vecLiteral}::vector, ${now})
      ON CONFLICT ("placeId") DO UPDATE SET
        model = EXCLUDED.model,
        embedding = EXCLUDED.embedding,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }

  /**
   * Return the `limit` placeIds whose embeddings are nearest to
   * `embedding` under L2 distance, ascending (closest first).
   *
   * `<->` is the L2 / Euclidean distance operator in pgvector. For
   * cosine similarity, switch to `<=>` (would also change the index
   * op-class to `vector_cosine_ops`).
   */
  async findSimilar(embedding: number[], limit: number): Promise<SimilarEmbedding[]> {
    assertDimension(embedding);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`findSimilar: limit must be a positive integer, got ${limit}`);
    }
    const vecLiteral = toVectorLiteral(embedding);
    return this.prisma.$queryRaw<SimilarEmbedding[]>`
      SELECT
        "placeId",
        (embedding <-> ${vecLiteral}::vector)::double precision AS distance
      FROM "PlaceEmbedding"
      ORDER BY embedding <-> ${vecLiteral}::vector
      LIMIT ${limit}
    `;
  }
}

export interface SimilarEmbedding {
  readonly placeId: string;
  readonly distance: number;
}

function assertDimension(vec: number[]): void {
  if (vec.length !== EXPECTED_DIMENSIONS) {
    throw new Error(`expected ${EXPECTED_DIMENSIONS}-dim vector, got ${vec.length}`);
  }
}

/**
 * pgvector accepts `[v1,v2,...]::vector`. JSON.stringify would wrap the
 * array but the inner format is fortunately identical to pgvector's
 * bracketed input syntax.
 */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
