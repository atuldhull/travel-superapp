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
 *   - `listAllKeys`                — paginated bucket enumeration
 *                                    used by the orphan-sweep cron.
 *                                    Returns every object key in
 *                                    the bucket. Bounded by the
 *                                    bucket size; v1 inboxes are
 *                                    small, but a future scale-up
 *                                    may want a streaming variant.
 *                                    Added by `[IV.18.18.5]`.
 *   - `deleteObject`               — drop a single key. Idempotent
 *                                    by S3 contract: deleting a
 *                                    missing key is a no-op + 204.
 *                                    Added by `[IV.18.18.5]`.
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
  listAllKeys(): Promise<readonly string[]>;
  deleteObject(key: string): Promise<void>;
  /**
   * V.UX.38 — bucket reachability probe used by `S3HealthIndicator`.
   * Resolves with `{ ok: false, error }` instead of throwing so the
   * /health/ready check stays soft on S3 (an S3 hiccup must NOT
   * flip pods to Unhealthy and bounce them out of the LB pool).
   */
  pingBucket(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}

export const STORAGE_PROVIDER = Symbol('StorageProvider');
