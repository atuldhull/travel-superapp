/**
 * Port for itinerary persistence. Today the stub use-case creates
 * empty days (no items); the port surface already includes item
 * creation so a later `GenerateItineraryUseCase` (AI-backed) drops
 * in without a port change.
 *
 * Installed by prompt [IV.18.2.4].
 */
import type { ItineraryDay, ItineraryItem } from '../../domain/itinerary.entity';

export interface CreateItemInput {
  readonly position: number;
  readonly placeId: string | null;
  readonly notes?: string | null;
  readonly startTime?: Date | null;
  readonly endTime?: Date | null;
}

export interface CreateDayInput {
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: Date;
  readonly summary?: string | null;
  /**
   * Items to insert for this day in the same transaction as the
   * day row. Empty / absent → day is created without any items.
   */
  readonly items?: readonly CreateItemInput[];
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

  /**
   * Look up a single day by id, scoped to the caller's user so an
   * attacker can't edit another user's day even if they guess the
   * cuid. Returns `null` on miss. The domain shape includes items
   * (empty when the day has none).
   */
  findDayForUser(dayId: string, userId: string): Promise<ItineraryDay | null>;
  /**
   * Look up a single day by id WITHOUT an owner gate. The caller
   * is responsible for running an access gate (owner or active
   * trip-share) before invoking. Used by collab-edit paths
   * `[IV.18.2.14]` where access can be granted via a TripShare
   * the caller doesn't directly own.
   */
  findDayById(dayId: string): Promise<ItineraryDay | null>;

  /**
   * Atomically replace every item for a day. Empty `items` wipes
   * the day clean. Returns the updated day (with the new item
   * set) from a fresh read inside the same transaction.
   */
  replaceItemsForDay(dayId: string, items: readonly CreateItemInput[]): Promise<ItineraryDay>;
}

export const ITINERARY_REPOSITORY = Symbol('ItineraryRepository');
