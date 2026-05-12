/**
 * Prisma adapter for `MediaAssetRepository`. No PostGIS writes
 * here — `coordinates` is optional on the schema and unused in
 * v1. Later slices extend this via `GeoQueries` when EXIF
 * extraction flows through.
 *
 * `markReady` uses `updateMany` + `count === 1` gate so the
 * owner-scope check runs atomically. Repeat-confirm (row already
 * `ready`) still hits count=1 in `updateMany`, so the second call
 * reads back the same row and the use-case layer stays
 * idempotent.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { MediaAsset as PrismaMediaAsset, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  MediaAsset,
  MediaAssetVariant,
  MediaKind,
  MediaStatus,
} from '../domain/media-asset.entity';
import type {
  AdminMediaListInput,
  AdminMediaListResult,
  CreateMediaAssetInput,
  MediaAssetRepository,
  StoredVariant,
} from '../application/ports/media-asset.repository';

@Injectable()
export class PrismaMediaAssetRepository implements MediaAssetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const row = await this.prisma.mediaAsset.create({
      data: {
        ownerId: input.ownerId,
        tripId: input.tripId,
        kind: input.kind,
        s3KeyRaw: input.s3KeyRaw,
        // `status` defaults to `processing` at the schema level.
      },
    });
    return toDomain(row);
  }

  async markReady(id: string, ownerId: string): Promise<MediaAsset | null> {
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId },
      data: { status: 'ready' },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async setTripForOwner(
    id: string,
    ownerId: string,
    tripId: string | null,
  ): Promise<MediaAsset | null> {
    // Owner-scoped updateMany — same pattern as `markReady`. Count
    // being 0 means either the id is unknown or the caller isn't
    // the owner; both collapse to a 404 at the use-case layer.
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId },
      data: { tripId },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listForTripOwner(
    tripId: string,
    ownerId: string,
    limit: number,
  ): Promise<readonly MediaAsset[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { tripId, ownerId, status: 'ready' },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async setMemoryBookForOwner(
    id: string,
    ownerId: string,
    memoryBookId: string | null,
  ): Promise<MediaAsset | null> {
    // Same owner-scoped updateMany pattern as setTripForOwner.
    // The book-owner check lives in the use-case; the repo only
    // gates on the asset's owner.
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId },
      data: { memoryBookId },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async adminList(input: AdminMediaListInput): Promise<AdminMediaListResult> {
    const where: Prisma.MediaAssetWhereInput = {};
    if (input.ownerId !== undefined) where.ownerId = input.ownerId;
    if (input.kind !== undefined) where.kind = input.kind;
    if (input.status !== undefined) where.status = input.status;
    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { rows: rows.map(toDomain), total };
  }

  async adminDelete(id: string): Promise<boolean> {
    // No owner scope — admin can wipe any media. The schema's
    // SetNull cascade on `MediaAsset.tripId` + `memoryBookId`
    // means attached trips and memory books survive (they just
    // lose their reference to this media row).
    const result = await this.prisma.mediaAsset.deleteMany({ where: { id } });
    return result.count === 1;
  }

  async markExifStrippedForOwner(id: string, ownerId: string): Promise<MediaAsset | null> {
    // Same updateMany + count gate the rest of this adapter uses.
    // Already-stripped rows still get count=1 from Postgres, so
    // re-call is naturally idempotent.
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId },
      data: { exifStripped: true },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listAllS3Keys(): Promise<ReadonlySet<string>> {
    // Single SELECT of just the s3KeyRaw column — cheap even at
    // moderate inbox sizes. The orphan-sweep cron consumes this
    // as a Set so the per-key membership check is O(1).
    const rows = await this.prisma.mediaAsset.findMany({
      select: { s3KeyRaw: true },
    });
    return new Set(rows.map((r) => r.s3KeyRaw));
  }

  async updateVariants(
    id: string,
    ownerId: string,
    variants: readonly StoredVariant[],
  ): Promise<MediaAsset | null> {
    const result = await this.prisma.mediaAsset.updateMany({
      where: { id, ownerId },
      data: { variants: variants as unknown as Prisma.InputJsonValue },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: PrismaMediaAsset): MediaAsset {
  return {
    id: row.id,
    ownerId: row.ownerId,
    tripId: row.tripId,
    memoryBookId: row.memoryBookId,
    kind: row.kind as MediaKind,
    status: row.status as MediaStatus,
    s3KeyRaw: row.s3KeyRaw,
    exifStripped: row.exifStripped,
    caption: row.caption ?? null,
    position: row.position,
    variants: extractVariants(row.variants),
    createdAt: row.createdAt,
  };
}

/** POST.5 — read `variants` JSON column and keep only entries that
 *  match the canonical shape. POST.1 seed wrote Unsplash CDN entries
 *  with `{ cdnUrl, credit, unsplashId }` in the same column; those
 *  are silently filtered out so legacy seed data doesn't poison the
 *  typed entity. */
function extractVariants(raw: Prisma.JsonValue | null): readonly MediaAssetVariant[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MediaAssetVariant[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      if (
        typeof e['label'] === 'string' &&
        typeof e['format'] === 'string' &&
        typeof e['s3Key'] === 'string' &&
        typeof e['width'] === 'number' &&
        typeof e['height'] === 'number' &&
        typeof e['bytes'] === 'number' &&
        typeof e['sha256'] === 'string'
      ) {
        out.push({
          label: e['label'],
          format: e['format'],
          s3Key: e['s3Key'],
          width: e['width'],
          height: e['height'],
          bytes: e['bytes'],
          sha256: e['sha256'],
        });
      }
    }
  }
  return out.length > 0 ? out : null;
}
