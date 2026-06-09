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
   *  exposed geo + publishedAt cleared. POST.2C.2 — this ALSO NULLs
   *  the pgvector `embedding` in the SAME single SQL statement as the
   *  visibility flip (de-index on unpublish — no ghost can linger in
   *  discovery / grounding). No-op if no row. */
  setPrivate(tripId: string, authorId: string): Promise<void>;
  /** POST.2C.2 — best-effort embed-on-publish. Writes the 1024-dim
   *  vector via raw SQL (`Unsupported("vector(1024)")` is invisible to
   *  the typed client). `null` → no-op (skip-index: keep any prior
   *  embedding, never wipe on a transient Ollama outage). A non-1024
   *  vector is REJECTED (`assertEmbeddingDimension`) BEFORE any DB
   *  write. Owner-scoped. */
  setEmbedding(tripId: string, authorId: string, embedding: number[] | null): Promise<void>;
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
  /** POST.2B.3 — does `viewerId` follow `authorId`? (seeds the creator
   *  profile Follow button). */
  isFollowing(viewerId: string, authorId: string): Promise<boolean>;
  /** Either-direction block between the two users (seeds the creator
   *  profile Block button + disables Follow when blocked). */
  isBlockedBetween(viewerId: string, authorId: string): Promise<boolean>;
  /** POST.2C.3 — pgvector nearest PUBLISHED trips to `embedding`
   *  (L2 `<->` via the `TripPublication_embedding_ivfflat` index,
   *  `vector_l2_ops` — consistent with VectorQueries). Visibility +
   *  block filtered AS `viewerId` and the viewer's own trips
   *  excluded; only rows with a non-null embedding. NON-NEGOTIABLE
   *  security: PRIVATE + blocked never returned (LAW 2). */
  findSimilarByVector(
    embedding: number[],
    viewerId: string,
    limit: number,
  ): Promise<readonly SimilarTrip[]>;
  /** Same, but the query vector is the embedding of an already-
   *  PUBLISHED `sourceTripId` (the "trips like this" rail). The
   *  source trip is excluded; if it has no embedding → `[]` (the
   *  rail renders EmptyState — no crash). */
  findSimilarToPublication(
    sourceTripId: string,
    viewerId: string,
    limit: number,
  ): Promise<readonly SimilarTrip[]>;
  /** Phase 5 (J3) — suggested travellers to follow: authors of PUBLIC
   *  published trips, excluding the viewer, anyone they already
   *  follow, blocked pairs, and soft-deleted users. Ranked by how
   *  many PUBLIC trips they've published (most prolific first). */
  listSuggestedTravellers(viewerId: string, limit: number): Promise<readonly SuggestedTraveller[]>;
  /** Phase 5 (J5) — PUBLIC published trips near the query centre.
   *  When the query carries dates, only date-overlapping trips (or
   *  trips with no dates) are returned. Excludes the viewer's own
   *  trips, the source trip, and blocked pairs. */
  findTripBuddies(query: TripBuddyQuery): Promise<readonly TripBuddy[]>;
}

/** A nearest published-trip hit (title joined from `Trip`). */
export interface SimilarTrip {
  readonly tripId: string;
  readonly title: string;
  readonly authorId: string;
  /** L2 distance — smaller = closer. */
  readonly distance: number;
}

/**
 * Phase 5 (J3) — a suggested traveller to follow: an author of
 * PUBLIC published trips the viewer doesn't already follow.
 */
export interface SuggestedTraveller {
  readonly userId: string;
  readonly displayName: string;
  readonly publishedCount: number;
}

/**
 * Phase 5 (J5) — a candidate travel buddy: another PUBLIC published
 * trip near the viewer's trip.
 *
 * Matchmaking is PLACE-based, not date-filtered: a published trip is
 * by definition ENDED (past), so a hard date-overlap filter would
 * return nothing for anyone planning a future trip. We surface
 * nearby travellers and SHOW their dates so the viewer can see when
 * they were there — an honest "who has journeyed near here", not a
 * false "travel together" promise.
 */
export interface TripBuddy {
  readonly tripId: string;
  readonly title: string;
  readonly authorId: string;
  /** Coarsened (≈city-level) location — never the precise centre. */
  readonly exposedLat: number;
  readonly exposedLng: number;
  readonly startsOn: Date | null;
  readonly endsOn: Date | null;
}

/** J5 — query for `findTripBuddies`. Coordinates are the viewer's
 *  trip centre; matching is a coarse proximity box. */
export interface TripBuddyQuery {
  readonly lat: number;
  readonly lng: number;
  readonly viewerId: string;
  readonly excludeTripId: string;
  readonly limit: number;
}

export const TRIP_PUBLICATION_REPOSITORY = Symbol('TripPublicationRepository');
