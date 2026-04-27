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
import type { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

const MAX_CAPTION_LENGTH = 280;

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

    const trimmed = (cmd.caption ?? '').trim();
    const next = trimmed.length === 0 ? null : trimmed.slice(0, MAX_CAPTION_LENGTH);

    // Direct Prisma write — the repo doesn't yet have a typed
    // `setCaption` and adding one would be ceremony for a single
    // call site.
    const row = await this.prisma.mediaAsset.update({
      where: { id: cmd.assetId },
      data: { caption: next },
    });

    return {
      ...asset,
      caption: row.caption ?? null,
    };
  }
}
