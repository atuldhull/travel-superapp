/**
 * notification-worker — entrypoint.
 *
 * Consumes the `notifications` BullMQ queue. Each job carries
 * { userId, channel, template, vars }; the handler routes to the
 * appropriate dispatcher (push / email / SMS).
 *
 * Today the handler is a STUB that logs the job — the real dispatchers
 * still run inline inside apps/api (Resend / Twilio / web-push). The
 * migration path is in [Q3]'s job-queues design doc. Wiring this stub
 * NOW means:
 *   1. The queue + worker connection is exercised on every boot.
 *   2. The fitness gate on Worker.close() lifecycle is honoured.
 *   3. The first real consumer migration becomes "replace the stub",
 *      not "stand up the worker".
 *
 * Installed by [Q3] of the Scale-readiness 3→10 series.
 */
import { makeWorker, type JobPayloads } from '@app/jobs';
import { createLogger, type LogLevel } from '@app/logger';

/**
 * Per-app env validation — the worker only needs REDIS_URL + LOG_LEVEL,
 * so we deliberately do NOT use `@app/config`'s `validateEnv` (which is
 * shaped for `apps/api` and demands DATABASE_URL, JWT secrets, etc.).
 * Each app should validate only what it consumes — that's the same
 * "scope-locked" rule that applies to imports.
 */
function readWorkerEnv(): { REDIS_URL: string; LOG_LEVEL: LogLevel } {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    // Fail fast — without Redis, the worker has nothing to do.
    // eslint-disable-next-line no-restricted-syntax -- bootstrap before logger
    process.stderr.write('FATAL: REDIS_URL is required for notification-worker\n');
    process.exit(1);
  }
  const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
  return { REDIS_URL, LOG_LEVEL };
}

async function main(): Promise<void> {
  const env = readWorkerEnv();
  const logger = createLogger('notification-worker', { level: env.LOG_LEVEL });

  logger.info({ redisUrl: redactUrl(env.REDIS_URL) }, 'notification-worker booting');

  const worker = makeWorker('notifications', {
    redisUrl: env.REDIS_URL,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? '10'),
    handler: async (job) => {
      const { userId, channel, template, vars } = job.data as JobPayloads['notifications'];
      // STUB: log + ack. Real dispatchers wire up in the migration PR
      // that replaces inline sends inside apps/api.
      logger.info(
        { jobId: job.id, userId, channel, template, varsKeys: Object.keys(vars) },
        'notification-job consumed (stub)',
      );
    },
  });

  worker.on('failed', (job, err) => {
    logger.warn(
      { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
      'notification-job failed',
    );
  });
  worker.on('error', (err) => {
    // Connection / backend errors arrive here — keep the worker
    // alive; BullMQ reconnects on the next blocking command.
    logger.error({ err: err.message }, 'notification-worker backend error');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'notification-worker draining');
    try {
      await worker.close();
      logger.info('notification-worker closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'notification-worker close failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({ concurrency: worker.opts.concurrency }, 'notification-worker ready');
}

/** Strip the password from a redis URL for logging. */
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
