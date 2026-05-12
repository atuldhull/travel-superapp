/**
 * Plain-data `MediaAsset` domain entity. v1 tracks just the
 * fields needed for presigned-upload flow: ownership, kind,
 * lifecycle status, the raw S3 key, and (since `[IV.18.12.14]`)
 * the EXIF-stripped flag that gates location-derived features.
 * `variants` / `coordinates` / `takenAt` land in later slices
 * when the media service transcodes + strips EXIF out-of-band.
 *
 * `exifStripped`: confirm-upload sets this to `true` for
 * `kind: 'image'` as a stub — real strip-then-reupload happens
 * out-of-band in `media-service`. Until then any feature that
 * derives location/EXIF from the raw bytes MUST gate on this
 * flag and refuse to surface raw EXIF to other users.
 *
 * Installed by prompt [IV.18.12.1].
 */
export type MediaKind = 'image' | 'video';
export type MediaStatus = 'processing' | 'ready' | 'failed';

/** POST.5 — one entry in `MediaAsset.variants` for an image's
 *  Sharp-generated alternates (thumb / medium WebP). Optional on
 *  the entity because legacy rows + videos + freshly-uploaded
 *  images (before the pipeline runs) have no variants yet. */
export interface MediaAssetVariant {
  readonly label: string;
  readonly format: string;
  readonly s3Key: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

export interface MediaAsset {
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
   *  the pipeline). Shape mirrors `MediaAsset.variants` in the
   *  Prisma schema. */
  readonly variants: readonly MediaAssetVariant[] | null;
  readonly createdAt: Date;
}
