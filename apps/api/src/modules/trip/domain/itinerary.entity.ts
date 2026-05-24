/**
 * Domain shapes for `ItineraryDay` + `ItineraryItem`. Mirrors the
 * Prisma models but stays framework-free so the application layer can
 * reason about itinerary structure without pulling `@prisma/client`
 * into domain code.
 *
 * DDD refactor by [G4.4]: `ItineraryItem` becomes a class with the
 * standard `static create()` + `static fromPersistence()` pair. No
 * use-case currently mints items at the application boundary (the
 * AI generator + day-replan flows hand `CreateItemInput[]` to the
 * repo directly), so the entity invariants below are defense-in-depth
 * — they catch a malformed item if a future use-case ever does.
 *
 *   I1 dayId non-empty
 *   I2 position is a non-negative integer
 *   I3 notes (when set) ≤ ITINERARY_ITEM_MAX_NOTES_CHARS after trim
 *   I4 startTime ≤ endTime when both present
 *
 * `ItineraryDay` stays a plain interface — it's a list-of-items shape
 * the repo assembles; no use-case-level invariants own it.
 *
 * Installed by prompt [IV.18.2.4]; entity-ized by [G4.4].
 */
import { ValidationError } from '@app/errors';

export const ITINERARY_ITEM_MAX_NOTES_CHARS = 4000;

/** Input shape for `ItineraryItem.create()` — minus id / timestamps. */
export interface CreateItineraryItemInput {
  readonly dayId: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime?: Date | null;
  readonly endTime?: Date | null;
  readonly notes?: string | null;
}

/** Row shape returned by the Prisma adapter. */
export interface ItineraryItemPersistenceRow {
  readonly id: string;
  readonly dayId: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export class ItineraryItem {
  readonly id: string;
  readonly dayId: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Phase 3 (G1) — "living trip" completion checkmark. Null until
   *  the traveller marks the item done. */
  readonly completedAt: Date | null;

  private constructor(row: ItineraryItemPersistenceRow) {
    this.id = row.id;
    this.dayId = row.dayId;
    this.position = row.position;
    this.placeId = row.placeId;
    this.startTime = row.startTime;
    this.endTime = row.endTime;
    this.notes = row.notes;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
    this.completedAt = row.completedAt;
  }

  /**
   * Validate + return a normalised CreateItineraryItemInput.
   * Today's use-cases don't call this — see the entity-level note —
   * but a future GenerateItineraryUseCase or DayReplanUseCase can
   * route through it without changing the contract.
   */
  static create(input: CreateItineraryItemInput): CreateItineraryItemInput {
    if (typeof input.dayId !== 'string' || input.dayId.length === 0) {
      throw new ValidationError(
        'dayId must be a non-empty string',
        { dayId: ['must be non-empty'] },
        {},
        'INVALID_ITINERARY_ITEM',
      );
    }
    if (!Number.isInteger(input.position) || input.position < 0) {
      throw new ValidationError(
        'position must be a non-negative integer',
        { position: ['must be ≥ 0'] },
        { position: input.position },
        'INVALID_ITINERARY_ITEM',
      );
    }
    const notes = input.notes?.trim() || null;
    if (notes && notes.length > ITINERARY_ITEM_MAX_NOTES_CHARS) {
      throw new ValidationError(
        `notes must be ≤ ${ITINERARY_ITEM_MAX_NOTES_CHARS} chars`,
        { notes: ['too long'] },
        { length: notes.length },
        'INVALID_ITINERARY_ITEM',
      );
    }
    if (
      input.startTime instanceof Date &&
      input.endTime instanceof Date &&
      input.startTime > input.endTime
    ) {
      throw new ValidationError(
        'startTime must be ≤ endTime',
        { startTime: ['must be earlier'] },
        { startTime: input.startTime.toISOString(), endTime: input.endTime.toISOString() },
        'INVALID_ITINERARY_ITEM',
      );
    }
    return { ...input, notes };
  }

  /** Wrap a persisted row in an `ItineraryItem` instance. */
  static fromPersistence(row: ItineraryItemPersistenceRow): ItineraryItem {
    return new ItineraryItem(row);
  }
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
