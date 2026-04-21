/**
 * Resolve a share code to the shared trip's public-safe metadata.
 * Unauthenticated callers (the whole point of a share code) reach
 * this via `GET /api/v1/trips/shared/:code` which is `@Public()`.
 *
 * Rules:
 *   - missing code row                    → 404 `SHARE_NOT_FOUND`
 *   - row exists but publicRead=false     → 404 `SHARE_NOT_FOUND`
 *     (future revoke endpoint flips the flag instead of deleting —
 *      both paths collapse to the same recipient-facing response)
 *   - row exists but expiresAt ≤ now     → 404 `SHARE_EXPIRED`
 *   - row exists + owner row is gone     → 404 `TRIP_NOT_FOUND`
 *     (trip deletion cascades TripShare, so this is defence-in-depth
 *      more than a real race)
 *
 * Returns the trip domain row (without userId) + the owner's
 * displayName so the recipient sees "shared by Alice", plus the
 * itinerary days (with items) — recipients see the same shape
 * owners do via `GET /trips/:id/itinerary`, minus the auth gate.
 * Place data is catalog-public-ish; exposing `placeId` on a shared
 * link is intentional so recipient UIs can hydrate place details
 * through the normal Places surface.
 *
 * Installed by prompt [IV.18.2.13]; itinerary fold-in added in
 * prompt [IV.18.2.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

export interface ResolvedShare {
  readonly trip: Trip;
  readonly ownerDisplayName: string;
  readonly expiresAt: Date | null;
  readonly days: readonly ItineraryDay[];
}

@Injectable()
export class ResolveTripShareUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    // Narrow direct dep on Prisma for the single `user.findUnique`
    // (displayName lookup). Putting a minimal port around a single
    // read-by-id would be ceremony for its own sake — the broader
    // Identity module's user repo is focused on auth, not
    // display-name lookups.
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(code: string): Promise<ResolvedShare> {
    const share = await this.shares.findByCode(code);
    if (!share || !share.publicRead) {
      throw new NotFoundError('Share not found', { shareCode: code }, 'SHARE_NOT_FOUND');
    }
    if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundError(
        'Share has expired',
        { shareCode: code, expiredAt: share.expiresAt.toISOString() },
        'SHARE_EXPIRED',
      );
    }

    const trip = await this.trips.findByIdForUser(share.tripId, share.ownerId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: share.tripId }, 'TRIP_NOT_FOUND');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: share.ownerId },
      select: { displayName: true },
    });
    if (!owner) {
      // Owner deleted but cascade missed somehow — treat as "not
      // sharable anymore" to the recipient.
      throw new NotFoundError('Trip not found', { tripId: share.tripId }, 'TRIP_NOT_FOUND');
    }

    const days = await this.itinerary.listDays(trip.id);

    return {
      trip,
      ownerDisplayName: owner.displayName,
      expiresAt: share.expiresAt,
      days,
    };
  }
}
