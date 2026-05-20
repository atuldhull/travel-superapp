/**
 * Plain-data domain shapes for `ItineraryDay` + `ItineraryItem`.
 * Mirrors the Prisma models but stays framework-free so the
 * application layer can reason about itinerary structure without
 * pulling `@prisma/client` into domain code.
 *
 * Installed by prompt [IV.18.2.4].
 */
export interface ItineraryItem {
  readonly id: string;
  readonly dayId: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Phase 3 (G1) — "living trip" completion checkmark. Null until
  // the traveller marks the item done. The planner/regenerator
  // never touches this field; it's strictly user-driven.
  readonly completedAt: Date | null;
}

export interface ItineraryDay {
  readonly id: string;
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: Date;
  readonly summary: string | null;
  /**
   * Activities scheduled for this day, ordered by `position` asc.
   * Empty array means the day has no activities yet — the
   * generator may return days with no items when no places are
   * available in the trip's radius.
   */
  readonly items: readonly ItineraryItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
