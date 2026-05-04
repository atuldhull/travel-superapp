/**
 * V.UX.38 — S3 health indicator. Wraps `StorageProvider.pingBucket()`
 * (which itself catches every error and returns `{ ok, error }`).
 *
 * The indicator's terminus `status` is **always 'up'** — it reports
 * "the probe ran" rather than "the bucket is reachable". The actual
 * bucket reachability is exposed via the `bucketStatus: 'up' | 'down'`
 * + `error` sub-fields on the result.
 *
 * Why this shape: terminus flips the overall /health/ready response
 * to 503 whenever ANY indicator returns `status: 'down'`. S3 hiccups
 * should NOT bounce api pods out of the LB pool — they're a softer
 * signal than Postgres/Redis (a queued media upload retries; a
 * dropped DB connection is fatal). The /ops dashboard reads
 * `info.s3.bucketStatus` to render the real S3 health, while LBs
 * keep routing traffic through transient S3 wobbles.
 */
import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../modules/media/application/ports/storage-provider';

const KEY = 's3';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const ping = await this.storage.pingBucket();
    // ALWAYS up — see file header. Real bucket status lives in details.
    return this.getStatus(KEY, true, {
      bucketStatus: ping.ok ? 'up' : 'down',
      latencyMs: ping.latencyMs,
      ...(ping.error !== undefined ? { error: ping.error } : {}),
    });
  }
}
