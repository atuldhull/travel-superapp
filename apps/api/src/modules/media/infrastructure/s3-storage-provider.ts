/**
 * S3-compatible storage adapter. Uses the AWS SDK's
 * `getSignedUrl` (pure HMAC — works in every runtime) to produce
 * presigned URLs, then dispatches actual HTTP via Node's native
 * fetch. Avoiding `client.send()` sidesteps the AWS SDK's
 * dynamic-import path which is incompatible with Jest's VM
 * sandbox (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`) while
 * staying perfectly idiomatic in prod: only the HTTP adapter is
 * different.
 *
 *   - `forcePathStyle: true` — MinIO doesn't speak virtual-hosted
 *     addressing; also works against real S3 / R2.
 *   - `ensureBucket` on module init — MinIO in dev/test starts
 *     empty, so HEAD the configured bucket and CREATE it on
 *     first boot. Any error is logged but not thrown; the first
 *     real upload will surface a genuine misconfig.
 *   - Presigned URLs sign the `Content-Type` header: clients
 *     MUST PUT with the exact same header or S3 rejects.
 *
 * Installed by prompt [IV.18.12.1].
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import type {
  PresignedUploadRequest,
  StorageProvider,
} from '../application/ports/storage-provider';

const log = createLogger('media.storage.s3');

/**
 * Short-lived internal signature TTL for HeadObject / HeadBucket /
 * CreateBucket calls. Only the URL has to outlive one round-trip,
 * and we don't want stale signatures lying around in logs.
 */
const INTERNAL_SIG_TTL_SEC = 60;

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  /**
   * V.UX.38 — soft S3 reachability probe. Issues a presigned
   * HEAD against the bucket; reports OK on 2xx (or even 404 since
   * "no such object" still proves the bucket connection is alive).
   * Catches every error so the caller (S3HealthIndicator) never
   * accidentally flips /health/ready to Unhealthy on a transient
   * S3 hiccup.
   */
  async pingBucket(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const headCmd = new HeadBucketCommand({ Bucket: this.bucket });
      const url = await getSignedUrl(this.client, headCmd, { expiresIn: INTERNAL_SIG_TTL_SEC });
      const res = await fetch(url, { method: 'HEAD' });
      const latencyMs = Date.now() - startedAt;
      if (res.ok || res.status === 404) {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async createPresignedUploadUrl(req: PresignedUploadRequest): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: req.key,
      ContentType: req.contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: req.expiresSec });
  }

  async createPresignedDownloadUrl(key: string, expiresSec: number): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresSec });
  }

  async objectExists(key: string): Promise<boolean> {
    const cmd = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: INTERNAL_SIG_TTL_SEC });
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status === 404) return false;
    if (res.ok) return true;
    throw new Error(`Unexpected HeadObject status ${res.status}`);
  }

  /**
   * Paginates ListObjectsV2 until `IsTruncated=false`. Returns
   * every key in the bucket. Same presign-then-fetch pattern as
   * the rest of this adapter so the AWS SDK's dynamic-import path
   * never executes (Jest VM compatibility).
   *
   * Response is `application/xml`; we extract `<Key>` elements
   * with a narrow regex rather than pulling in a full XML parser
   * — the response schema is locked by the S3 spec, and the
   * extraction shape ("everything between `<Key>` tags") is
   * trivially safe for keys that S3 itself accepts.
   *
   * Continuation token is XML-encoded; we URL-encode it for the
   * next request. Page size is bounded by S3 at 1000.
   */
  async listAllKeys(): Promise<readonly string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    // Hard upper bound to make the loop unconditionally terminating
    // even if a malformed response somehow lacked an IsTruncated
    // close. 1M keys is several lifetimes of v1 traffic.
    for (let page = 0; page < 1000; page++) {
      const cmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        ...(continuationToken !== undefined ? { ContinuationToken: continuationToken } : {}),
      });
      const url = await getSignedUrl(this.client, cmd, { expiresIn: INTERNAL_SIG_TTL_SEC });
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`ListObjectsV2 status ${res.status}`);
      }
      const body = await res.text();
      const pageKeys = extractXmlElements(body, 'Key');
      keys.push(...pageKeys);
      const truncated = extractXmlElements(body, 'IsTruncated')[0] === 'true';
      if (!truncated) return keys;
      const nextToken = extractXmlElements(body, 'NextContinuationToken')[0];
      if (nextToken === undefined) return keys;
      continuationToken = nextToken;
    }
    log.warn(
      { bucket: this.bucket, pages: 1000 },
      'list_all_keys_hit_safety_cap_returning_partial',
    );
    return keys;
  }

  async deleteObject(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: INTERNAL_SIG_TTL_SEC });
    const res = await fetch(url, { method: 'DELETE' });
    // S3 returns 204 for both "deleted" and "didn't exist" — both
    // are success from our caller's POV (idempotent semantics).
    if (res.status === 204 || res.ok) return;
    throw new Error(`DeleteObject status ${res.status}`);
  }

  private async ensureBucket(): Promise<void> {
    const headCmd = new HeadBucketCommand({ Bucket: this.bucket });
    let headUrl: string;
    try {
      headUrl = await getSignedUrl(this.client, headCmd, { expiresIn: INTERNAL_SIG_TTL_SEC });
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), bucket: this.bucket },
        'head_bucket_sign_failed_nonfatal',
      );
      return;
    }
    let exists = false;
    try {
      const headRes = await fetch(headUrl, { method: 'HEAD' });
      if (headRes.ok) {
        exists = true;
      } else if (headRes.status !== 404) {
        log.warn({ status: headRes.status, bucket: this.bucket }, 'head_bucket_unexpected_status');
        return;
      }
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), bucket: this.bucket },
        'head_bucket_failed_nonfatal',
      );
      return;
    }
    if (exists) return;

    const createCmd = new CreateBucketCommand({ Bucket: this.bucket });
    try {
      const createUrl = await getSignedUrl(this.client, createCmd, {
        expiresIn: INTERNAL_SIG_TTL_SEC,
      });
      const createRes = await fetch(createUrl, { method: 'PUT' });
      if (createRes.ok) {
        log.info({ bucket: this.bucket }, 'bucket_created');
        return;
      }
      // 409 = BucketAlreadyOwnedByYou (race with another process).
      if (createRes.status === 409) return;
      log.warn(
        { status: createRes.status, bucket: this.bucket },
        'create_bucket_unexpected_status',
      );
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err), bucket: this.bucket },
        'create_bucket_failed_nonfatal',
      );
    }
  }
}

/**
 * Extract every text node wrapped in `<tag>...</tag>` from an
 * XML string. Narrow on purpose — the S3 ListObjectsV2 response
 * has a flat enough shape that we don't need a real XML parser.
 * Skips self-closing tags. Greedy-safe because S3 keys cannot
 * contain literal `<` or `>` (they're %-escaped on the wire).
 */
function extractXmlElements(xml: string, tag: string): string[] {
  const out: string[] = [];
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let cursor = 0;
  while (true) {
    const start = xml.indexOf(open, cursor);
    if (start === -1) return out;
    const end = xml.indexOf(close, start + open.length);
    if (end === -1) return out;
    out.push(xml.slice(start + open.length, end));
    cursor = end + close.length;
  }
}
