/**
 * Adapter that implements `TripMediaPort` (defined in TripModule)
 * by delegating to `MEDIA_ASSET_REPOSITORY`. Lets the Trip-
 * overview use-case fold a media section without TripModule
 * gaining a Prisma dependency or knowing the MediaAsset shape.
 *
 * `count` is computed as a separate query (not `recent.length`)
 * because `recent` is capped at a small limit — clients need
 * the true total to render "and N more" in the trip-overview
 * thumbnail strip.
 *
 * Installed by prompt [IV.18.12.10].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { TripMediaPort, TripMediaSummary } from '../../trip/application/ports/trip-media.port';
import {
  MEDIA_ASSET_REPOSITORY,
  type MediaAssetRepository,
} from '../application/ports/media-asset.repository';

@Injectable()
export class TripMediaAdapter implements TripMediaPort {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async summarizeForTrip(
    tripId: string,
    ownerId: string,
    limit: number,
  ): Promise<TripMediaSummary> {
    // Two queries: bounded `recent` list (existing repo method,
    // already orders by createdAt desc + limits) + total count.
    // Both hit the existing `[tripId, createdAt]` index and the
    // `[ownerId, createdAt]` index — cheap.
    const [recent, count] = await Promise.all([
      this.media.listForTripOwner(tripId, ownerId, limit),
      this.prisma.mediaAsset.count({
        where: { tripId, ownerId, status: 'ready' },
      }),
    ]);
    return {
      count,
      recent: recent.map((m) => ({
        id: m.id,
        kind: m.kind,
        s3KeyRaw: m.s3KeyRaw,
        createdAt: m.createdAt,
      })),
    };
  }
}
