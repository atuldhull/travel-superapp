/**
 * Port for S3-compatible object storage. Keeps the use-case
 * layer ignorant of AWS SDK specifics so a future swap (R2 → S3 →
 * GCS) is a pure adapter change.
 *
 *   - `createPresignedUploadUrl`   — short-TTL PUT URL.
 *   - `createPresignedDownloadUrl` — short-TTL GET URL.
 *   - `objectExists`               — HEAD-based probe used by the
 *                                    confirm-upload flow to verify
 *                                    the upload actually landed
 *                                    before we flip the row to
 *                                    `ready`. `true` only if the
 *                                    object is present.
 *
 * Installed by prompt [IV.18.12.1].
 */
export interface PresignedUploadRequest {
  readonly key: string;
  readonly contentType: string;
  readonly expiresSec: number;
}

export interface StorageProvider {
  createPresignedUploadUrl(req: PresignedUploadRequest): Promise<string>;
  createPresignedDownloadUrl(key: string, expiresSec: number): Promise<string>;
  objectExists(key: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = Symbol('StorageProvider');
