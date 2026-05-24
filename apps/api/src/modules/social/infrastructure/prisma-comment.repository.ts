/**
 * Phase 5 (J4) — Prisma adapter for trip comments.
 *
 * `TripComment` is FK-less (Follow / UserBlock / TripPublication
 * precedent), so author display names are joined via a second
 * `user.findMany` rather than a relation include.
 *
 * Installed by prompt [J4].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripComment as PrismaTripComment } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import { TripComment, type TripCommentWithAuthor } from '../domain/trip-comment.entity';
import type {
  CommentRepository,
  CreateCommentInput,
} from '../application/ports/comment.repository';

function toDomain(row: PrismaTripComment): TripComment {
  return TripComment.fromPersistence({
    id: row.id,
    tripId: row.tripId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateCommentInput): Promise<TripComment> {
    const row = await this.prisma.tripComment.create({
      data: { tripId: input.tripId, authorId: input.authorId, body: input.body },
    });
    return toDomain(row);
  }

  async listForTrip(tripId: string, limit: number): Promise<readonly TripCommentWithAuthor[]> {
    const rows = await this.prisma.tripComment.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    if (rows.length === 0) return [];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.authorId) }, deletedAt: null },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(authors.map((u) => [u.id, u.displayName]));
    const out: TripCommentWithAuthor[] = [];
    for (const r of rows) {
      const authorDisplayName = nameById.get(r.authorId);
      if (authorDisplayName === undefined) continue; // dropped: deleted author
      out.push({ ...toDomain(r), authorDisplayName });
    }
    return out;
  }

  async findById(id: string): Promise<TripComment | null> {
    const row = await this.prisma.tripComment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tripComment.deleteMany({ where: { id } });
  }

  async findCommentableTrip(tripId: string): Promise<{ authorId: string } | null> {
    const pub = await this.prisma.tripPublication.findUnique({
      where: { tripId },
      select: { authorId: true, visibility: true, publishedAt: true },
    });
    if (!pub || pub.publishedAt === null || pub.visibility === 'PRIVATE') return null;
    return { authorId: pub.authorId };
  }

  async countForTrip(tripId: string): Promise<number> {
    return this.prisma.tripComment.count({ where: { tripId } });
  }
}
