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

export interface MediaAsset {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: MediaKind;
  readonly status: MediaStatus;
  readonly s3KeyRaw: string;
  readonly exifStripped: boolean;
  readonly createdAt: Date;
}
