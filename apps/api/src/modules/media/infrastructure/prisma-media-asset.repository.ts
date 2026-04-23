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
import type { MediaAsset as PrismaMediaAsset } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { MediaAsset, MediaKind, MediaStatus } from '../domain/media-asset.entity';
import type {
  CreateMediaAssetInput,
  MediaAssetRepository,
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
}

function toDomain(row: PrismaMediaAsset): MediaAsset {
  return {
    id: row.id,
    ownerId: row.ownerId,
    tripId: row.tripId,
    kind: row.kind as MediaKind,
    status: row.status as MediaStatus,
    s3KeyRaw: row.s3KeyRaw,
    createdAt: row.createdAt,
  };
}
