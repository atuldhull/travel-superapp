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
}

export const MEDIA_ASSET_REPOSITORY = Symbol('MediaAssetRepository');
