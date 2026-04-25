/**
 * Port for MediaAsset persistence. Three ops:
 *   - `create`      — insert a new row in `processing` status.
 *   - `markReady`   — flip status to `ready`; scoped to owner, used
 *                     after `storage.headObject` has confirmed the
 *                     upload actually landed.
 *   - `findByIdForOwner` — owner-gated lookup. Returns `null` for
 *                     wrong-id OR wrong-owner (IDOR-safe 404).
 *
 * Installed by prompt [IV.18.12.1]. Admin-flavored methods added
 * by [IV.18.18.4].
 */
import type { MediaAsset, MediaKind, MediaStatus } from '../../domain/media-asset.entity';

export interface CreateMediaAssetInput {
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: MediaKind;
  readonly s3KeyRaw: string;
}

export interface MediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  /**
   * Atomically flips the row to `ready` if it's owned by `ownerId`.
   * Returns the updated row, or `null` if it doesn't exist / isn't
   * owned by the caller. A repeat-confirm returns the already-ready
   * row (idempotent).
   */
  markReady(id: string, ownerId: string): Promise<MediaAsset | null>;
  findByIdForOwner(id: string, ownerId: string): Promise<MediaAsset | null>;
  /**
   * Set (or clear, with `null`) the asset's `tripId`. Owner-gated —
   * returns `null` if the media row doesn't exist OR isn't owned
   * by the caller, which the use-case maps to 404 `MEDIA_NOT_FOUND`.
   * Trip existence + ownership is the use-case's job to validate
   * before calling this — the repo doesn't re-check.
   */
  setTripForOwner(id: string, ownerId: string, tripId: string | null): Promise<MediaAsset | null>;
  /**
   * List the caller's media assets attached to `tripId`. Excludes
   * `processing` rows — only `ready` rows are returned, so clients
   * never render a broken thumbnail during the upload-confirm window.
   * Most-recent-first ordering matches every other "list mine"
   * surface in the codebase.
   */
  listForTripOwner(tripId: string, ownerId: string, limit: number): Promise<readonly MediaAsset[]>;
  /**
   * Set (or clear, with `null`) the asset's `memoryBookId`. Same
   * owner-gated shape as `setTripForOwner`. The use-case validates
   * that the target memory book exists + is owned by the caller
   * before calling this. [IV.18.12.6]
   */
  setMemoryBookForOwner(
    id: string,
    ownerId: string,
    memoryBookId: string | null,
  ): Promise<MediaAsset | null>;

  /**
   * Admin paginated list across ALL users — drives the media
   * moderation queue. Returns `{ rows, total }`. Filters:
   * `ownerId` (exact match), `kind` (image|video), `status`
   * (processing|ready|failed). Most-recent-first ordering.
   * Added by `[IV.18.18.4]`.
   */
  adminList(input: AdminMediaListInput): Promise<AdminMediaListResult>;

  /**
   * Admin hard-delete (no owner scope) for takedowns of abusive
   * content. Returns `true` iff a row was actually removed.
   * Schema-level `SetNull` on `tripId` and `memoryBookId` means
   * attached trips and memory books survive (they just lose the
   * media reference). The S3 object behind `s3KeyRaw` is NOT
   * cleaned up here — orphan-object sweep is a future cron
   * concern.
   * Added by `[IV.18.18.4]`.
   */
  adminDelete(id: string): Promise<boolean>;

  /**
   * Returns the set of all `s3KeyRaw` values currently referenced
   * by some MediaAsset row. Used by the orphan-sweep cron to decide
   * which bucket objects are reachable and which are orphaned.
   *
   * Bounded by total media-row count; v1 inboxes are small, but a
   * future scale-up may want a streaming/chunked variant or a
   * smarter "diff S3 against DB in pages" approach.
   *
   * Added by `[IV.18.18.5]`.
   */
  listAllS3Keys(): Promise<ReadonlySet<string>>;

  /**
   * Atomically flip `exifStripped = true` on a row the caller
   * owns. Returns the updated row, or `null` when the id is
   * unknown OR owned by a different user (collapsed to 404 at
   * the use-case layer for IDOR safety). Idempotent: a re-call
   * on an already-stripped row still returns the row.
   *
   * v1 stub semantics: the byte-level EXIF strip happens
   * out-of-band in `media-service`; this just records that the
   * stub flag has been set. Any feature that surfaces raw
   * location/EXIF to other users MUST gate on this flag.
   *
   * Added by `[IV.18.12.14]`.
   */
  markExifStrippedForOwner(id: string, ownerId: string): Promise<MediaAsset | null>;
}

export interface AdminMediaListInput {
  readonly ownerId?: string;
  readonly kind?: MediaKind;
  readonly status?: MediaStatus;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminMediaListResult {
  readonly rows: readonly MediaAsset[];
  readonly total: number;
}

export const MEDIA_ASSET_REPOSITORY = Symbol('MediaAssetRepository');
