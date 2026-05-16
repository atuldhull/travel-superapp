/**
 * POST.2B.2 — port for trip publications.
 *
 * `setPrivate` is the unpublish seam: it flips visibility → PRIVATE
 * and clears exposed geo + publishedAt. POST.2C.2 extends it to also
 * NULL the embedding in the SAME transaction (de-index on unpublish).
 *
 * Installed by prompt [POST.2B.2].
 */
import type { TripPublication, Visibility } from '../../domain/trip-publication.entity';

export interface UpsertPublishInput {
  readonly tripId: string;
  readonly authorId: string;
  readonly memoryBookId: string | null;
  readonly visibility: Visibility;
  readonly exposedLat: number | null;
  readonly exposedLng: number | null;
  readonly publishedAt: Date;
}

export interface TripPublicationRepository {
  upsertPublish(input: UpsertPublishInput): Promise<TripPublication>;
  /** Idempotent unpublish (owner-scoped): visibility → PRIVATE,
   *  exposed geo + publishedAt cleared. No-op if no row. */
  setPrivate(tripId: string, authorId: string): Promise<void>;
  findByTrip(tripId: string): Promise<TripPublication | null>;
  /** POST.2B.3 — the pull feed: ONE indexed query, reverse-chron,
   *  cursor-paginated. Excludes PRIVATE, excludes the viewer's own,
   *  excludes blocked pairs (either direction), and only surfaces
   *  FOLLOWERS posts from authors the viewer actually follows. */
  listFeed(
    viewerId: string,
    limit: number,
    before: Date | null,
  ): Promise<readonly TripPublication[]>;
  /** Creator profile: an author's published trips the viewer may
   *  see (same visibility + block rules). */
  listByAuthorVisibleTo(
    authorId: string,
    viewerId: string,
    limit: number,
  ): Promise<readonly TripPublication[]>;
  countPublishedByAuthor(authorId: string): Promise<number>;
  countFollowers(authorId: string): Promise<number>;
}

export const TRIP_PUBLICATION_REPOSITORY = Symbol('TripPublicationRepository');
