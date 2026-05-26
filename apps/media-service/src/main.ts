/**
 * media-service — entrypoint.
 *
 * Consumes the `media-variants` BullMQ queue. Each job carries
 * { assetId, sourceKey }; the handler reads the source from S3/R2,
 * runs Sharp to emit avif/webp/thumb variants, and updates the
 * `MediaAsset` row to `ready`.
 *
 * Today the handler is a STUB that logs the job — the real Sharp
 * pipeline still runs inline inside apps/api (see media/infrastructure).
 * Wiring the worker NOW means the deploy stack is ready when the
 * pipeline migrates.
 *
 * Installed by [Q4] of the Scale-readiness 3→10 series — was a 1-line
 * placeholder until this slice gave it a Dockerfile + fly.toml.
 */
import { makeWorker, type JobPayloads } from '@app/jobs';
import { createLogger, type LogLevel } from '@app/logger';

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

  logger.info({ redisUrl: redactUrl(env.REDIS_URL) }, 'media-service booting');

  const worker = makeWorker('media-variants', {
    redisUrl: env.REDIS_URL,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? '4'),
    handler: async (job) => {
      const { assetId, sourceKey } = job.data as JobPayloads['media-variants'];
      // STUB: log + ack. Real Sharp pipeline migrates from apps/api
      // in a follow-up PR.
      logger.info({ jobId: job.id, assetId, sourceKey }, 'media-variants job consumed (stub)');
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
