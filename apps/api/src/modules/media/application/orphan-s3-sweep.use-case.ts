/**
 * Companion to `[IV.18.18.4]` admin media moderation. The admin
 * delete verb intentionally leaves S3 bytes behind — DB row
 * controls reachability, and clients can't enumerate S3 keys, so
 * a hard-deleted media row is "gone" from every authed surface
 * even before the bytes are wiped. This use-case runs async to
 * close that loop: any S3 object whose key is NOT referenced by
 * a current MediaAsset row gets deleted from the bucket.
 *
 * Trade-offs:
 *   - **Eventual consistency.** Between an admin-delete and the
 *     next sweep tick, the bucket holds bytes for a now-deleted
 *     row. Acceptable: the bytes are unreachable through any
 *     authed endpoint (the DB row is the only handle).
 *   - **Race window during uploads.** If a user begins an upload
 *     between `listAllS3Keys` and `listAllKeys`, the bucket may
 *     contain a key that has no row YET (the confirm-upload step
 *     is async). To avoid wiping in-flight uploads, we ignore any
 *     bucket key that matches the schema's "processing" prefix
 *     convention isn't reliable, so the simpler protection is to
 *     fetch DB keys AFTER the bucket list — the DB will then
 *     include any row created during the bucket walk. With
 *     order: bucket-first → DB-second, a key that appears in
 *     bucket but not DB at the time of the diff is genuinely
 *     orphaned.
 *
 * Returns `{ scanned, deleted }` so the scheduler can log + tests
 * can assert.
 *
 * Installed by prompt [IV.18.18.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

const log = createLogger('media.orphan-s3-sweep');

export interface OrphanSweepResult {
  readonly scanned: number;
  readonly deleted: number;
}

@Injectable()
export class OrphanS3SweepUseCase {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
  ) {}

  async execute(): Promise<OrphanSweepResult> {
    // Bucket-first, DB-second: any row created during the bucket
    // walk lands in the DB set, so its key isn't mistaken for an
    // orphan. The reverse order would create a false-positive
    // window for in-flight uploads.
    const bucketKeys = await this.storage.listAllKeys();
    const dbKeys = await this.media.listAllS3Keys();

    let deleted = 0;
    for (const key of bucketKeys) {
      if (dbKeys.has(key)) continue;
      try {
        await this.storage.deleteObject(key);
        deleted++;
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err), key },
          'orphan_delete_failed_continuing',
        );
        // Skip on per-key error — next sweep retries.
      }
    }

    log.info({ scanned: bucketKeys.length, deleted }, 'orphan_sweep_done');
    return { scanned: bucketKeys.length, deleted };
  }
}
