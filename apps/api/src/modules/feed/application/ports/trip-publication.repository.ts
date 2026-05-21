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

export const TRIP_PUBLICATION_REPOSITORY = Symbol('TripPublicationRepository');
