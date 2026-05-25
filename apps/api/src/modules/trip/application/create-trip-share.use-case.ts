/**
 * Mint a new share code for a trip the caller owns. Code is 16
 * URL-safe chars (12 bytes of `crypto.randomBytes` → base64url) —
 * ~72 bits of entropy is plenty for a non-guessable opaque token
 * that never appears in logs.
 *
 * Ownership gate — `TripRepository.findByIdForUser` — returns null
 * if the trip is missing OR owned by a different user. We map
 * that single signal to 404 `TRIP_NOT_FOUND` (same as GET /trips/:id)
 * so attackers can't probe existence by generating share codes.
 *
 * Expiry is optional. When present, must be in the future; the
 * Zod DTO already rejects past dates, and we re-check here so
 * off-HTTP callers can't sneak a past expiry in.
 *
 * Installed by prompt [IV.18.2.13].
 */
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import type { TripShare } from '../domain/trip-share.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

export interface CreateTripShareCommand {
  readonly tripId: string;
  readonly ownerId: string;
  readonly expiresAt?: Date | null;
}

@Injectable()
export class CreateTripShareUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateTripShareCommand): Promise<TripShare> {
    if (cmd.expiresAt && cmd.expiresAt.getTime() <= this.clock.nowMs()) {
      throw new ValidationError(
        'expiresAt must be in the future',
        { expiresAt: ['must be in the future'] },
        { expiresAt: cmd.expiresAt.toISOString() },
        'INVALID_EXPIRY',
      );
    }

    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.ownerId);
    if (!trip) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    return this.shares.create({
      tripId: trip.id,
      ownerId: cmd.ownerId,
      shareCode: generateShareCode(),
      expiresAt: cmd.expiresAt ?? null,
    });
  }
}

function generateShareCode(): string {
  // 12 random bytes → 16 base64url chars. URL-safe (no +, /, =) so the
  // code can drop into a path segment without encoding.
  return randomBytes(12).toString('base64url');
}
