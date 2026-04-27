/**
 * List the authenticated user's trips, split by role:
 *   - `owned` — trips where the caller is the creator (`Trip.userId`).
 *   - `collaborated` — trips where someone else owns it but the
 *     caller has cast a vote or recorded an expense.
 *
 * Both lists are newest-first and capped at `limit`. The controller
 * surfaces them as a single `{ owned, collaborated }` shape so the
 * V.UX.9 `/trips` page can render badges + filters in one render
 * pass. The two lists are disjoint by construction (`Trip.userId`
 * filter on each).
 *
 * Installed by prompt [IV.18.2.3]; collaborated split added by `[V.UX.9]`.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface ListTripsResult {
  readonly owned: readonly Trip[];
  readonly collaborated: readonly Trip[];
}

@Injectable()
export class ListTripsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(userId: string, limit = 20): Promise<ListTripsResult> {
    const [owned, collaborated] = await Promise.all([
      this.trips.listByUser(userId, limit),
      this.trips.listCollaboratedByUser(userId, limit),
    ]);
    return { owned, collaborated };
  }
}
