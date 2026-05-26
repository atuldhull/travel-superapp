/**
 * crawler-worker — entrypoint.
 *
 * Consumes the `crawler-recrawl` BullMQ queue. Each job carries
 * { placeId, reason }; the handler re-fetches Google Places +
 * Foursquare + OSM for the place, dedups, and upserts.
 *
 * Today the handler is a STUB that logs the job — the real Playwright
 * + federated catalog logic still lives in apps/api/modules/places.
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
    process.stderr.write('FATAL: REDIS_URL is required for crawler-worker\n');
    process.exit(1);
  }
  return { REDIS_URL, LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info') as LogLevel };
}

async function main(): Promise<void> {
  const env = readWorkerEnv();
  const logger = createLogger('crawler-worker', { level: env.LOG_LEVEL });

  logger.info({ redisUrl: redactUrl(env.REDIS_URL) }, 'crawler-worker booting');

  const worker = makeWorker('crawler-recrawl', {
    redisUrl: env.REDIS_URL,
    // Crawlers are I/O-bound on external APIs; default low concurrency
    // so we don't blow rate-limit budgets per provider.
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? '2'),
    handler: async (job) => {
      const { placeId, reason } = job.data as JobPayloads['crawler-recrawl'];
      // STUB: log + ack. Real Playwright + federated-catalog logic
      // migrates from apps/api/modules/places in a follow-up PR.
      logger.info({ jobId: job.id, placeId, reason }, 'crawler-recrawl job consumed (stub)');
    },
  });

  worker.on('failed', (job, err) => {
    logger.warn(
      { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
      'crawler-recrawl job failed',
    );
  });
  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'crawler-worker backend error');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'crawler-worker draining');
    try {
      await worker.close();
      logger.info('crawler-worker closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'crawler-worker close failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({ concurrency: worker.opts.concurrency }, 'crawler-worker ready');
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
