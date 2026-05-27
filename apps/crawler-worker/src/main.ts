/**
 * crawler-worker — entrypoint.
 *
 * Consumes the `crawler-recrawl` BullMQ queue. Each job carries
 * { placeId, reason, center?, name?, radiusM? }; the handler fans
 * out across OSM Overpass (always on) + Google Places + Foursquare
 * (both gated on their API-key env vars) and reports a collated,
 * de-duplicated CrawlSummary via the structured logger.
 *
 * Persistence migration: the worker does NOT yet upsert Place rows —
 * apps/api still owns that path. [S-B5] adds the worker→api callback
 * that lands the crawled rows. Logging the summary today gives ops a
 * working pipeline they can observe before flipping the write path.
 *
 * Scaffold installed by [Q4]; real provider fan-out wired by [S-B3].
 */
import { makeWorker, type JobPayloads } from '@app/jobs';
import { createLogger, type LogLevel } from '@app/logger';
import { buildCrawlerRouter } from './providers';

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
  const router = buildCrawlerRouter();

  logger.info(
    { redisUrl: redactUrl(env.REDIS_URL), providers: router.status() },
    'crawler-worker booting',
  );

  const worker = makeWorker('crawler-recrawl', {
    redisUrl: env.REDIS_URL,
    // Crawlers are I/O-bound on external APIs; default low concurrency
    // so we don't blow rate-limit budgets per provider.
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? '2'),
    handler: async (job) => {
      const payload = job.data as JobPayloads['crawler-recrawl'];
      const { placeId, reason, center, name, radiusM } = payload;
      // Backward-compatible: pre-[S-B3] producers only sent placeId+reason.
      // Without `center` we have nothing to query — log + ack.
      if (!center) {
        logger.info(
          { jobId: job.id, placeId, reason },
          'crawler-recrawl skipped — no center coordinates in payload',
        );
        return;
      }
      const summary = await router.crawl(
        {
          lat: center.lat,
          lng: center.lng,
          radiusM: radiusM ?? 250,
          ...(name ? { nameHint: name } : {}),
        },
        logger,
      );
      logger.info(
        {
          jobId: job.id,
          placeId,
          reason,
          center,
          radiusM: radiusM ?? 250,
          hits: summary.hits.length,
          perProvider: summary.perProvider,
          skippedProviders: summary.skippedProviders,
          elapsedMs: summary.elapsedMs,
          // First few hits inline for spot-checking. Full results land
          // in the DB once [S-B5] wires the worker→api callback.
          sample: summary.hits.slice(0, 5).map((h) => ({
            provider: h.provider,
            externalId: h.externalId,
            name: h.name,
            distanceMeters: h.distanceMeters,
          })),
        },
        'crawler-recrawl crawled',
      );
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
