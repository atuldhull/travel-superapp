/**
 * Phase 5 (J4) — a comment on a published trip.
 *
 * Flat (no threading) in v1. Domain is intentionally thin: the
 * commentability gate (trip must be published) + block gate live in
 * the use-case, not here, because they need repositories.
 *
 * Installed by prompt [J4].
 */

/** Max comment length — long enough for a real remark, short enough
 *  that the thread stays a thread (not a forum of essays). */
export const MAX_COMMENT_LENGTH = 1000;

export interface TripComment {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A comment joined to its author's display name, for the thread UI. */
export interface TripCommentWithAuthor extends TripComment {
  readonly authorDisplayName: string;
}
