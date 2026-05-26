/**
 * Minimal S3-compatible client for the media-variants worker.
 *
 * The worker only needs two operations: GET the source object and PUT
 * each generated variant back under a deterministic key. Direct
 * `client.send(...)` is fine here — the jest-VM issue that drives
 * apps/api's `getSignedUrl + fetch` pattern doesn't apply to a Node
 * worker process (no jest sandbox).
 *
 * Configuration via env (mirrors apps/api):
 *   - S3_ENDPOINT         (e.g. http://127.0.0.1:9000 for MinIO local)
 *   - S3_REGION           (e.g. us-east-1)
 *   - S3_BUCKET           (e.g. travel-dev)
 *   - S3_ACCESS_KEY
 *   - S3_SECRET_KEY
 *
 * Installed by [S-B2] of the S-series real-functionality closeout.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export function readS3ConfigFromEnv(): S3Config {
  const required = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`media-service: missing S3 env: ${missing.join(', ')}`);
  }
  return {
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION!,
    bucket: process.env.S3_BUCKET!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
  };
}

export class WorkerS3Client {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // MinIO + R2 + S3 all happy with path-style
    });
    this.bucket = config.bucket;
  }

  /** Download an object as a Buffer. Throws on miss / network error. */
  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`s3 get ${key}: empty body`);
    }
    return streamToBuffer(response.Body as Readable);
  }

  /** Upload a Buffer under `key`. Returns on 2xx. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Cleanup — close the underlying HTTP agent. */
  destroy(): void {
    this.client.destroy();
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
