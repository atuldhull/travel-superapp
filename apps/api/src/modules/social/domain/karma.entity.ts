/**
 * V.UX.25 — reviewer-karma + helpful-vote domain shapes. Plain
 * data; persistence stays behind repository ports.
 *
 * `score` formula (kept simple for v1):
 *   score = reviewCount * 1 + helpfulVotesReceived * 2
 *
 * A single helpful vote outweighs a single review — quality > quantity.
 *
 * `badges` is a flat string[] keyed in the use-case so new
 * thresholds don't need a schema migration.
 *
 * Installed by prompt [V.UX.25].
 */
export interface UserKarma {
  readonly id: string;
  readonly userId: string;
  readonly score: number;
  readonly reviewCount: number;
  readonly helpfulVotesReceived: number;
  readonly badges: readonly string[];
  readonly recomputedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PublicReviewerProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly karma: UserKarma;
  /** Last N reviews authored, newest first. Capped by use-case. */
  readonly recentReviews: ReadonlyArray<{
    readonly id: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly rating: number;
    readonly body: string;
    readonly createdAt: Date;
  }>;
}
