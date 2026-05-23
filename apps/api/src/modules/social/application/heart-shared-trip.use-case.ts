/**
 * V.UX.10 anonymous react. The recipient of a public share link can
 * tap "❤️ this trip" without signing up. Each tap bumps a per-trip
 * Redis counter; the controller route is `@Public()` and IP-rate-
 * limited at the framework level (1/min).
 *
 * Why per-trip and not per-share-code: the same trip may have many
 * shares minted; aggregating by trip gives a single creator-visible
 * "this plan got 47 hearts" metric regardless of how it was
 * distributed.
 *
 * Installed by prompt [V.UX.10].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from '../../trip';
import {
  TRIP_HEART_COUNTER_PORT,
  type TripHeartCounterPort,
} from './ports/trip-heart-counter.port';

@Injectable()
export class HeartSharedTripUseCase {
  constructor(
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(TRIP_HEART_COUNTER_PORT) private readonly counter: TripHeartCounterPort,
  ) {}

  async execute(shareCode: string): Promise<{ readonly tripId: string; readonly hearts: number }> {
    const share = await this.shares.findByCode(shareCode);
    if (!share || !share.publicRead) {
      throw new NotFoundError('Share not found', { shareCode }, 'SHARE_NOT_FOUND');
    }
    if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundError(
        'Share has expired',
        { shareCode, expiredAt: share.expiresAt.toISOString() },
        'SHARE_EXPIRED',
      );
    }
    const hearts = await this.counter.increment(share.tripId);
    return { tripId: share.tripId, hearts };
  }
}
