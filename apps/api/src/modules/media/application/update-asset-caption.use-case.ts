/**
 * V.UX.11: per-asset caption editing for memory-book story mode.
 * Owner-only — the asset's `ownerId` must match the caller. The
 * memoryBookId in the URL must match the asset's current
 * `memoryBookId` (so a stranger guessing asset cuids can't edit
 * captions on assets they don't have a relationship with).
 *
 * Empty / blank caption clears the field (`caption = null`).
 *
 * Installed by prompt [V.UX.11].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

export interface UpdateAssetCaptionCommand {
  readonly memoryBookId: string;
  readonly assetId: string;
  readonly ownerId: string;
  readonly caption: string | null;
}

@Injectable()
export class UpdateAssetCaptionUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly assets: MediaAssetRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: UpdateAssetCaptionCommand): Promise<MediaAsset> {
    const asset = await this.assets.findByIdForOwner(cmd.assetId, cmd.ownerId);
    if (!asset || asset.memoryBookId !== cmd.memoryBookId) {
      throw new NotFoundError(
        `Asset not found: ${cmd.assetId}`,
        { memoryBookId: cmd.memoryBookId, assetId: cmd.assetId },
        'MEDIA_NOT_FOUND',
      );
    }

    // [G4.3] normalisation lives on the entity — trim, empty → null,
    // cap at MEDIA_MAX_CAPTION_CHARS by slice (forgiving UX).
    const next = MediaAsset.normaliseCaption(cmd.caption);

    // Direct Prisma write — the repo doesn't yet have a typed
    // `setCaption` and adding one would be ceremony for a single
    // call site. Rewrap the row through fromPersistence() so the
    // returned value is a real MediaAsset, not a spread plain object.
    const row = await this.prisma.mediaAsset.update({
      where: { id: cmd.assetId },
      data: { caption: next },
    });

    return MediaAsset.fromPersistence({
      id: asset.id,
      ownerId: asset.ownerId,
      tripId: asset.tripId,
      memoryBookId: asset.memoryBookId,
      kind: asset.kind,
      status: asset.status,
      s3KeyRaw: asset.s3KeyRaw,
      exifStripped: asset.exifStripped,
      caption: row.caption ?? null,
      position: asset.position,
      variants: asset.variants,
      createdAt: asset.createdAt,
    });
  }
}
