/**
 * Plain-data `MediaAsset` domain entity. v1 tracks just the
 * fields needed for presigned-upload flow: ownership, kind,
 * lifecycle status, and the raw S3 key. `variants` /
 * `coordinates` / `takenAt` land in later slices when the media
 * service transcodes + strips EXIF out-of-band.
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
  readonly createdAt: Date;
}
