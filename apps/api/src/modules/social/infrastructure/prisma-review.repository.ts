/**
 * Prisma adapter for `ReviewRepository`. Direct delegate — no
 * raw SQL (no PostGIS in Review).
 *
 * Installed by prompt [IV.18.12.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Review as PrismaReview } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import type {
  CreateReviewInput,
  ListByTargetInput,
  ReviewRatingHistogram,
  ReviewRepository,
  ReviewSummary,
} from '../application/ports/review.repository';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateReviewInput): Promise<Review> {
    const row = await this.prisma.review.create({
      data: {
        authorId: input.authorId,
        tripId: input.tripId,
        targetType: input.targetType,
        targetId: input.targetId,
        rating: input.rating,
        body: input.body,
        language: input.language,
      },
    });
    return toDomain(row);
  }

  async listByTarget(input: ListByTargetInput): Promise<readonly Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { targetType: input.targetType, targetId: input.targetId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(input.limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async listByAuthor(authorId: string, limit: number): Promise<readonly Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async deleteForAuthor(id: string, authorId: string): Promise<boolean> {
    // Scoped deleteMany — atomic "delete only if I wrote it" check.
    // count=0 collapses "missing" vs "not my review" into one 404.
    const result = await this.prisma.review.deleteMany({
      where: { id, authorId },
    });
    return result.count === 1;
  }

  async aggregateByTarget(targetType: ReviewTargetType, targetId: string): Promise<ReviewSummary> {
    // groupBy hits the existing `(targetType, targetId)` index +
    // returns at most 5 rows (one per rating bucket). The DB does
    // the count/average; we only zero-fill missing buckets.
    const rows = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { targetType, targetId },
      _count: { _all: true },
    });

    const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let weighted = 0;
    for (const row of rows) {
      const bucket = row.rating as 1 | 2 | 3 | 4 | 5;
      // Defensive — schema guarantees rating ∈ [1..5] but a future
      // schema change shouldn't crash the public summary endpoint.
      if (bucket < 1 || bucket > 5) continue;
      const count = row._count._all;
      histogram[bucket] = count;
      total += count;
      weighted += bucket * count;
    }
    // Round to 2 decimals so the wire shape is stable + clients
    // don't render `4.333333333333333` in a star widget.
    const average = total === 0 ? 0 : Math.round((weighted / total) * 100) / 100;
    return {
      targetType,
      targetId,
      count: total,
      average,
      histogram: histogram as ReviewRatingHistogram,
    };
  }

  async setResponse(input: {
    readonly id: string;
    readonly responseBody: string;
  }): Promise<Review | null> {
    // Conditional update — only writes when responseBody IS NULL.
    // Re-submits hit count=0 and the use-case turns that into
    // `REVIEW_RESPONSE_LOCKED` (the response is one-shot to keep
    // the wire shape simple; an admin/edit flow lands in a follow-up).
    const result = await this.prisma.review.updateMany({
      where: { id: input.id, responseBody: null },
      data: { responseBody: input.responseBody, responseAt: new Date() },
    });
    if (result.count === 0) return null;
    const row = await this.prisma.review.findUnique({ where: { id: input.id } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: PrismaReview): Review {
  return {
    id: row.id,
    authorId: row.authorId,
    tripId: row.tripId,
    targetType: row.targetType as ReviewTargetType,
    targetId: row.targetId,
    rating: row.rating,
    body: row.body,
    language: row.language,
    verifiedBooking: row.verifiedBooking,
    responseBody: row.responseBody,
    responseAt: row.responseAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
