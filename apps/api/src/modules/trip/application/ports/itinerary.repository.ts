/**
 * Port for itinerary persistence. Today the stub use-case creates
 * empty days (no items); the port surface already includes item
 * creation so a later `GenerateItineraryUseCase` (AI-backed) drops
 * in without a port change.
 *
 * Installed by prompt [IV.18.2.4].
 */
import type { ItineraryDay, ItineraryItem } from '../../domain/itinerary.entity';

export interface CreateDayInput {
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: Date;
  readonly summary?: string | null;
}

export interface ItineraryRepository {
  /**
   * Replace every existing day for the trip with a fresh set. Used
   * by the stub + future generator — "re-plan" is the expected
   * path, not "append to existing days". Idempotent on the input.
   */
  replaceDays(tripId: string, days: readonly CreateDayInput[]): Promise<readonly ItineraryDay[]>;

  /** List days ordered by `dayIndex` ascending. */
  listDays(tripId: string): Promise<readonly ItineraryDay[]>;

  /** Delete every day (+ cascaded items) for a trip. Useful for
   *  admin / `DELETE /trips/:id` flows. */
  clearAll(tripId: string): Promise<void>;

  /** Optional: list items for a day. Kept minimal — the stub doesn't
   *  create items. */
  listItemsForDay(dayId: string): Promise<readonly ItineraryItem[]>;
}

export const ITINERARY_REPOSITORY = Symbol('ItineraryRepository');
