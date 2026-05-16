/**
 * POST.2B.1 — a directed follow edge (follower → followee).
 *
 * Immutable: unfollow deletes the row (not an append-only log).
 * Plain readonly interface per the project's domain convention.
 *
 * Installed by prompt [POST.2B.1].
 */
export interface Follow {
  readonly followerId: string;
  readonly followeeId: string;
  readonly createdAt: Date;
}
