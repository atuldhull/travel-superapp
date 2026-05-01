/**
 * V.UX.25 — port for HelpfulVote persistence. Tiny surface: insert
 * (with dedup), count for a review.
 *
 * Installed by prompt [V.UX.25].
 */
export interface HelpfulVoteRepository {
  /**
   * Insert a (reviewId, voterId) row. Returns `'inserted'` on the
   * first call, `'duplicate'` on a re-vote (the unique index makes
   * the second insert collide; the adapter swallows + returns the
   * marker). The use-case maps `'duplicate'` to a 200 idempotent
   * response, NOT a 409 — re-clicking "helpful" is a UX nicety,
   * not an error.
   */
  insertOnce(input: {
    readonly reviewId: string;
    readonly voterId: string;
  }): Promise<'inserted' | 'duplicate'>;

  countForReview(reviewId: string): Promise<number>;
}

export const HELPFUL_VOTE_REPOSITORY = Symbol('HelpfulVoteRepository');
