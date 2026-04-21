/**
 * Plain-data domain shapes for `ItineraryDay` + `ItineraryItem`.
 * Mirrors the Prisma models but stays framework-free so the
 * application layer can reason about itinerary structure without
 * pulling `@prisma/client` into domain code.
 *
 * Installed by prompt [IV.18.2.4].
 */
export interface ItineraryDay {
  readonly id: string;
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: Date;
  readonly summary: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

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
}
