/**
 * Port for MediaAsset persistence. Three ops:
 *   - `create`      — insert a new row in `processing` status.
 *   - `markReady`   — flip status to `ready`; scoped to owner, used
 *                     after `storage.headObject` has confirmed the
 *                     upload actually landed.
 *   - `findByIdForOwner` — owner-gated lookup. Returns `null` for
 *                     wrong-id OR wrong-owner (IDOR-safe 404).
 *
 * Installed by prompt [IV.18.12.1].
 */
import type { MediaAsset, MediaKind } from '../../domain/media-asset.entity';

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
}

export const MEDIA_ASSET_REPOSITORY = Symbol('MediaAssetRepository');
