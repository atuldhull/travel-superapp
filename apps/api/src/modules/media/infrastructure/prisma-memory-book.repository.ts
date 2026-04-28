/**
 * Prisma adapter for `MemoryBookRepository`. Direct delegate —
 * `MemoryBook` has no PostGIS / vector columns. Asset-ids lookup
 * cross-queries `MediaAsset` with `{ memoryBookId, ownerId,
 * status: 'ready' }` — same owner-scoping + `ready`-filter the
 * trip-listing adapter uses.
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { MemoryBook as PrismaMemoryBook } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { MemoryBook } from '../domain/memory-book.entity';
import type {
  CreateMemoryBookInput,
  MemoryBookAssetSummary,
  MemoryBookRepository,
  UpdateMemoryBookInput,
} from '../application/ports/memory-book.repository';

@Injectable()
export class PrismaMemoryBookRepository implements MemoryBookRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateMemoryBookInput): Promise<MemoryBook> {
    const row = await this.prisma.memoryBook.create({
      data: {
        ownerId: input.ownerId,
        title: input.title,
        theme: input.theme,
        coverS3Key: input.coverS3Key,
      },
    });
    return toDomain(row);
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<MemoryBook | null> {
    const row = await this.prisma.memoryBook.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async listForOwner(ownerId: string, limit: number): Promise<readonly MemoryBook[]> {
    const rows = await this.prisma.memoryBook.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async updateForOwner(
    id: string,
    ownerId: string,
    patch: UpdateMemoryBookInput,
  ): Promise<MemoryBook | null> {
    // Owner-scoped updateMany — atomic gate. Only build the
    // data object from present keys so an `undefined` value
    // never accidentally wipes a column.
    const data: { title?: string; theme?: string; coverS3Key?: string | null } = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.theme !== undefined) data.theme = patch.theme;
    if (patch.coverS3Key !== undefined) data.coverS3Key = patch.coverS3Key;
    if (Object.keys(data).length === 0) {
      // Nothing to update — just return the current row (or null).
      return this.findByIdForOwner(id, ownerId);
    }
    const result = await this.prisma.memoryBook.updateMany({
      where: { id, ownerId },
      data,
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.memoryBook.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async deleteForOwner(id: string, ownerId: string): Promise<boolean> {
    const result = await this.prisma.memoryBook.deleteMany({
      where: { id, ownerId },
    });
    return result.count === 1;
  }

  async listAssetIdsForOwner(bookId: string, ownerId: string): Promise<readonly string[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { memoryBookId: bookId, ownerId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async listAssetSummariesForOwner(
    bookId: string,
    ownerId: string,
  ): Promise<readonly MemoryBookAssetSummary[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { memoryBookId: bookId, ownerId, status: 'ready' },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, kind: true, caption: true, position: true },
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as 'image' | 'video',
      caption: r.caption,
      position: r.position,
    }));
  }

  async listPublishedAssetSummariesForBook(
    bookId: string,
  ): Promise<readonly MemoryBookAssetSummary[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { memoryBookId: bookId, status: 'ready' },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, kind: true, caption: true, position: true },
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as 'image' | 'video',
      caption: r.caption,
      position: r.position,
    }));
  }

  async setPublishedAtForOwner(
    id: string,
    ownerId: string,
    publishedAt: Date | null,
  ): Promise<MemoryBook | null> {
    // Same updateMany + count gate as the metadata update path.
    const result = await this.prisma.memoryBook.updateMany({
      where: { id, ownerId },
      data: { publishedAt },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.memoryBook.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findPublishedById(id: string): Promise<MemoryBook | null> {
    // No owner filter — public read. Gate is on `publishedAt`
    // being non-null. An unpublished book + a missing id collapse
    // to the same `null` (mapped to 404), so a stranger probing
    // the id space learns nothing about whether the book exists.
    const row = await this.prisma.memoryBook.findFirst({
      where: { id, publishedAt: { not: null } },
    });
    return row ? toDomain(row) : null;
  }

  async listPublished(limit: number): Promise<readonly MemoryBook[]> {
    // Public listing — no owner filter, only `publishedAt IS NOT NULL`.
    // FK cascade on User soft-purge already removes books for purged
    // users so we don't need to re-filter here. Sort by publishedAt
    // (newest first) — the marketing surface wants "what's new".
    const rows = await this.prisma.memoryBook.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async reorderAssetsForOwner(
    bookId: string,
    ownerId: string,
    orderedAssetIds: readonly string[],
  ): Promise<void> {
    if (orderedAssetIds.length === 0) return;
    // Per-row updateMany scoped to (bookId, ownerId) is the atomic
    // gate — a stranger's asset id smuggled in via the URL silently
    // updates 0 rows. The use-case has already validated the list
    // is a permutation of the currently-attached assets, so each
    // updateMany should hit exactly 1 row.
    await this.prisma.$transaction(
      orderedAssetIds.map((id, idx) =>
        this.prisma.mediaAsset.updateMany({
          where: { id, memoryBookId: bookId, ownerId },
          data: { position: idx },
        }),
      ),
    );
  }

  async findPublishedAssetForBook(
    bookId: string,
    assetId: string,
  ): Promise<{ readonly s3KeyRaw: string } | null> {
    // Three-clause gate in one query:
    //   1. The asset's `memoryBookId` matches the book.
    //   2. The asset is `ready`.
    //   3. The book is published (joined relation filter).
    // Joining via `memoryBook: { publishedAt: { not: null } }`
    // pushes the gate into a single round-trip — no N+1, no
    // separate "is the book published?" probe in the use-case.
    const row = await this.prisma.mediaAsset.findFirst({
      where: {
        id: assetId,
        memoryBookId: bookId,
        status: 'ready',
        memoryBook: { publishedAt: { not: null } },
      },
      select: { s3KeyRaw: true },
    });
    return row ? { s3KeyRaw: row.s3KeyRaw } : null;
  }
}

function toDomain(row: PrismaMemoryBook): MemoryBook {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    coverS3Key: row.coverS3Key,
    theme: row.theme,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
