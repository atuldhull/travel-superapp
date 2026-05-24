/**
 * `MediaAsset` domain entity. v1 tracks just the fields needed for
 * presigned-upload flow: ownership, kind, lifecycle status, the raw
 * S3 key, and (since `[IV.18.12.14]`) the EXIF-stripped flag that
 * gates location-derived features. `variants` (POST.5) /
 * `coordinates` / `takenAt` land in later slices when the media
 * service transcodes + strips EXIF out-of-band.
 *
 * `exifStripped`: confirm-upload sets this to `true` for
 * `kind: 'image'` as a stub — real strip-then-reupload happens
 * out-of-band in `media-service`. Until then any feature that
 * derives location/EXIF from the raw bytes MUST gate on this
 * flag and refuse to surface raw EXIF to other users.
 *
 * DDD refactor by [G4.3]:
 *   M1 ownerId + s3KeyRaw non-empty
 *   M2 kind ∈ {image, video}
 *   M3 caption (when set) ≤ MEDIA_MAX_CAPTION_CHARS after trim
 *   + `assertCanMarkReady(asset)` for the status state machine
 *     (`processing` → `ready` only; `ready`/`failed` terminal)
 *   + `normaliseCaption(input)` — the V.UX.11 trim+slice utility
 *
 * Installed by prompt [IV.18.12.1]; entity-ized by [G4.3].
 */
import { ConflictError, ValidationError } from '@app/errors';

export type MediaKind = 'image' | 'video';
export const MEDIA_KINDS: readonly MediaKind[] = ['image', 'video'];

export type MediaStatus = 'processing' | 'ready' | 'failed';
export const MEDIA_STATUSES: readonly MediaStatus[] = ['processing', 'ready', 'failed'];

export const MEDIA_MAX_CAPTION_CHARS = 280;

/** POST.5 — one entry in `MediaAsset.variants` for an image's
 *  Sharp-generated alternates (thumb / medium WebP). */
export interface MediaAssetVariant {
  readonly label: string;
  readonly format: string;
  readonly s3Key: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

/** Input shape for `MediaAsset.create()` — the new-asset payload
 *  BEFORE the DB assigns id + timestamps. Status defaults to
 *  `processing`; the caller doesn't choose it. */
export interface CreateMediaAssetInput {
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: MediaKind;
  readonly s3KeyRaw: string;
}

/** Row shape returned by the Prisma adapter. */
export interface MediaAssetPersistenceRow {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly memoryBookId: string | null;
  readonly kind: MediaKind;
  readonly status: MediaStatus;
  readonly s3KeyRaw: string;
  readonly exifStripped: boolean;
  readonly caption: string | null;
  readonly position: number;
  readonly variants: readonly MediaAssetVariant[] | null;
  readonly createdAt: Date;
}

export class MediaAsset {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly memoryBookId: string | null;
  readonly kind: MediaKind;
  readonly status: MediaStatus;
  readonly s3KeyRaw: string;
  readonly exifStripped: boolean;
  /** V.UX.11 — per-asset narrative for memory-book story mode. */
  readonly caption: string | null;
  /** V.UX.11 — sort order within the memory book (0-based). */
  readonly position: number;
  /** POST.5 — Sharp-generated alternates; `null` when the pipeline
   *  has not run (legacy rows, videos, or a fresh image still in
   *  the pipeline). */
  readonly variants: readonly MediaAssetVariant[] | null;
  readonly createdAt: Date;

  private constructor(row: MediaAssetPersistenceRow) {
    this.id = row.id;
    this.ownerId = row.ownerId;
    this.tripId = row.tripId;
    this.memoryBookId = row.memoryBookId;
    this.kind = row.kind;
    this.status = row.status;
    this.s3KeyRaw = row.s3KeyRaw;
    this.exifStripped = row.exifStripped;
    this.caption = row.caption;
    this.position = row.position;
    this.variants = row.variants;
    this.createdAt = row.createdAt;
  }

  /** Validate + return a normalised CreateMediaAssetInput ready for
   *  `MediaAssetRepository.create()`. */
  static create(input: CreateMediaAssetInput): CreateMediaAssetInput {
    if (typeof input.ownerId !== 'string' || input.ownerId.length === 0) {
      throw new ValidationError(
        'ownerId must be a non-empty string',
        { ownerId: ['must be non-empty'] },
        {},
        'INVALID_MEDIA_ASSET',
      );
    }
    if (typeof input.s3KeyRaw !== 'string' || input.s3KeyRaw.length === 0) {
      throw new ValidationError(
        's3KeyRaw must be a non-empty string',
        { s3KeyRaw: ['must be non-empty'] },
        {},
        'INVALID_MEDIA_ASSET',
      );
    }
    if (!MEDIA_KINDS.includes(input.kind)) {
      throw new ValidationError(
        `kind must be one of ${MEDIA_KINDS.join(' | ')}`,
        { kind: [`unknown: ${input.kind}`] },
        { kind: input.kind },
        'INVALID_MEDIA_ASSET',
      );
    }
    return input;
  }

  /** V.UX.11 caption normalisation. Empty / whitespace input clears
   *  the field (returns null). Non-empty input is trimmed and capped
   *  at MEDIA_MAX_CAPTION_CHARS (cap by slice, not throw, to keep the
   *  UX forgiving — a 281-char caption shouldn't reject the save). */
  static normaliseCaption(input: string | null | undefined): string | null {
    if (input === null || input === undefined) return null;
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, MEDIA_MAX_CAPTION_CHARS);
  }

  /** Status state machine — `processing` is the only legal source for
   *  `markReady`. Throws `ConflictError(MEDIA_STATUS_LOCKED)` for any
   *  other current status so the repo can't silently flip a `failed`
   *  row back to `ready`. */
  static assertCanMarkReady(asset: MediaAsset): void {
    if (asset.status !== 'processing') {
      throw new ConflictError(
        `Media asset cannot transition to ready from status "${asset.status}"`,
        { mediaId: asset.id, currentStatus: asset.status },
        'MEDIA_STATUS_LOCKED',
      );
    }
  }

  /** Wrap a persisted row in a `MediaAsset` instance. */
  static fromPersistence(row: MediaAssetPersistenceRow): MediaAsset {
    return new MediaAsset(row);
  }
}
