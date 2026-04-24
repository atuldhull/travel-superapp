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
  ReviewRepository,
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
