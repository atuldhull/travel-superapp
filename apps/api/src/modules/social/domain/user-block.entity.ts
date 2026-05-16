/**
 * POST.2B.1 — a directed block edge (blocker → blocked).
 *
 * A block between two users (in EITHER direction) refuses social
 * interaction between them (follow / vote / review). Immutable;
 * unblock deletes the row.
 *
 * Installed by prompt [POST.2B.1].
 */
export interface UserBlock {
  readonly blockerId: string;
  readonly blockedId: string;
  readonly createdAt: Date;
}
