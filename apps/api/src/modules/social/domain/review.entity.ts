/**
 * Plain-data `Review` domain entity. Mirrors the Prisma row.
 *
 * `tripId` is optional — reviews can be standalone (write a
 * review of a place you visited solo, no trip needed) or
 * trip-attached (so the trip's collaborators can read + the
 * author's "I went here on my Paris trip" context shows up).
 *
 * `targetType` is an enum: place | stay | eatery | agent.
 * Agents (marketplace) aren't implemented yet but the schema's
 * ready.
 *
 * `rating` is an integer 1..5; `body` is required non-empty;
 * `language` defaults to `'en'` and is an ISO-639-1 two-letter
 * code at the HTTP boundary. `verifiedBooking` starts false;
 * a future integration will flip it when the booking data
 * proves the reviewer actually stayed / visited.
 *
 * Unlike Vote (unique per user+target), Review has NO unique
 * constraint — a user can leave multiple reviews on the same
 * target from different trips over time.
 *
 * Installed by prompt [IV.18.12.5].
 */
export type ReviewTargetType = 'place' | 'stay' | 'eatery' | 'agent';

export interface Review {
  readonly id: string;
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  /**
   * V.UX.24 — target-owner reply (e.g. an agent replying to a
   * review about themselves). Stamped at most once; the use-case
   * rejects re-submissions. Null until the owner responds.
   */
  readonly responseBody: string | null;
  readonly responseAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
