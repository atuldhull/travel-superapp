/**
 * V.UX.9: read a trip + the caller's role on it. Replaces the
 * owner-only GET /trips/:id read for the collaborator surface.
 *
 * Access rules:
 *   - Caller == trip.userId → role='owner'.
 *   - Caller has voted OR paid an expense on the trip → role='collaborator'.
 *   - Otherwise → returns null (controller maps to 404 TRIP_NOT_FOUND
 *     to preserve the IDOR-safe existence-probe defence).
 *
 * Why participation-based rather than share-membership: the
 * `TripShare` model doesn't track recipients, so "active collaborator"
 * is observable only through the artefacts they've created. Same
 * heuristic the V.UX.9 collaborator listing uses.
 *
 * Installed by prompt [V.UX.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export type TripRole = 'owner' | 'collaborator';

export interface GetTripWithRoleResult {
  readonly trip: Trip;
  readonly role: TripRole;
  readonly ownerDisplayName: string | null;
}

@Injectable()
export class GetTripWithRoleUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(tripId: string, userId: string): Promise<GetTripWithRoleResult | null> {
    const ownTrip = await this.trips.findByIdForUser(tripId, userId);
    if (ownTrip) {
      return {
        trip: ownTrip,
        role: 'owner',
        ownerDisplayName: null,
      };
    }
    const trip = await this.trips.findById(tripId);
    if (!trip) return null;

    const [hasVote, hasExpense] = await Promise.all([
      this.prisma.vote.count({ where: { tripId, userId } }),
      this.prisma.expense.count({ where: { tripId, paidById: userId } }),
    ]);
    if (hasVote === 0 && hasExpense === 0) return null;

    const owner = await this.prisma.user.findUnique({
      where: { id: trip.userId },
      select: { displayName: true },
    });
    return {
      trip,
      role: 'collaborator',
      ownerDisplayName: owner?.displayName ?? null,
    };
  }
}
