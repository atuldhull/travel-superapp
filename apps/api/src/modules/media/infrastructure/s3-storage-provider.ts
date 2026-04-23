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
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
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
