/**
 * media-service — entrypoint.
 *
 * Consumes the `media-variants` BullMQ queue. Each job carries
 * { assetId, sourceKey }; the handler reads the source from S3/R2,
 * runs Sharp to emit two WebP variants (thumb 256w q70, medium 1024w q80),
 * and uploads each variant back at a deterministic key:
 *
 *   {sourceKey}.thumb.webp
 *   {sourceKey}.medium.webp
 *
 * The MediaAsset row update path (set status=ready + populate variants
 * column) does NOT run from this worker yet — apps/api still owns the
 * inline pipeline + DB write. Once apps/api migrates to enqueue
 * media-variants jobs (no inline Sharp), [S-B5] adds the worker→api
 * callback that flips the row.
 *
 * Scaffold installed by [Q4]; real Sharp pipeline wired by [S-B2].
 */
import { makeWorker, type JobPayloads } from '@app/jobs';
import { createLogger, type LogLevel } from '@app/logger';
import { generateVariants, type VariantLabel } from './sharp-processor';
import { readS3ConfigFromEnv, WorkerS3Client } from './s3-client';

function readWorkerEnv(): { REDIS_URL: string; LOG_LEVEL: LogLevel } {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    // eslint-disable-next-line no-restricted-syntax -- bootstrap before logger
    process.stderr.write('FATAL: REDIS_URL is required for media-service\n');
    process.exit(1);
  }
  return { REDIS_URL, LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info') as LogLevel };
}

async function main(): Promise<void> {
  const env = readWorkerEnv();
  const logger = createLogger('media-service', { level: env.LOG_LEVEL });

  // S3 config is REQUIRED — no graceful skip here. A media-service
  // without S3 has nothing to do, so fail-fast on boot rather than
  // silently dropping every job.
  const s3 = new WorkerS3Client(readS3ConfigFromEnv());

  logger.info({ redisUrl: redactUrl(env.REDIS_URL), s3Bucket: s3.bucket }, 'media-service booting');

  const worker = makeWorker('media-variants', {
    redisUrl: env.REDIS_URL,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? '4'),
    handler: async (job) => {
      const { assetId, sourceKey } = job.data as JobPayloads['media-variants'];
      const startMs = Date.now();
      const source = await s3.getObject(sourceKey);
      const variants = await generateVariants(source);
      // Upload in parallel — variants are independent of each other.
      await Promise.all(
        variants.map((v) => s3.putObject(variantKey(sourceKey, v.label), v.buffer, 'image/webp')),
      );
      logger.info(
        {
          jobId: job.id,
          assetId,
          sourceKey,
          sourceBytes: source.length,
          variants: variants.map((v) => ({
            label: v.label,
            bytes: v.bytes,
            width: v.width,
            height: v.height,
            sha256: v.sha256.slice(0, 16),
          })),
          elapsedMs: Date.now() - startMs,
        },
        'media-variants generated',
      );
    },
  });

  worker.on('failed', (job, err) => {
    logger.warn(
      { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
      'media-variants job failed',
    );
  });
  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'media-service backend error');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'media-service draining');
    try {
      await worker.close();
      s3.destroy();
      logger.info('media-service closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'media-service close failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({ concurrency: worker.opts.concurrency }, 'media-service ready');
}

/** Deterministic key for each generated variant. */
function variantKey(sourceKey: string, label: VariantLabel): string {
  return `${sourceKey}.${label}.webp`;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<unparseable>';
  }
}

void main();
