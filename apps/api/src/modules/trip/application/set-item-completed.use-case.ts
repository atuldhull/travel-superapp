/**
 * Toggle the "living trip" completion checkmark on a single
 * ItineraryItem. Phase 3 (G1).
 *
 * Owner gate via the trip relation on ItineraryItem. A non-owner
 * (or a missing/typo'd itemId) collapses to 404 ITEM_NOT_FOUND —
 * same existence-probe defence the rest of the Trip surface uses.
 *
 * `completedAt` is opaque to the planner — re-planning never carries
 * checkmarks forward (intentional: a fresh plan deserves fresh
 * progress).
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import type { ItineraryItem } from '../domain/itinerary.entity';

@Injectable()
export class SetItemCompletedUseCase {
  constructor(@Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository) {}

  /**
   * `completed=true` stamps `completedAt = now()`; `completed=false`
   * clears it back to null. Idempotent on either side.
   */
  async execute(itemId: string, userId: string, completed: boolean): Promise<ItineraryItem> {
    const next = completed ? new Date() : null;
    const updated = await this.itinerary.setItemCompletedForUser(itemId, userId, next);
    if (!updated) {
      throw new NotFoundError(`Itinerary item not found: ${itemId}`, { itemId }, 'ITEM_NOT_FOUND');
    }
    return updated;
  }
}
