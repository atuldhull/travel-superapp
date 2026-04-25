/**
 * Fastify hook that records `http_request_duration_seconds` for every
 * incoming HTTP request. Mirrors the lifecycle shape of
 * `register-trace-middleware.ts`:
 *
 *   - `onRequest` stamps a high-resolution start time on the request.
 *   - `onResponse` reads it, computes elapsed seconds, and calls
 *     `metrics.recordHttp(method, route, status, durationSec)`.
 *
 * **Route label = matched template, NOT raw path.** Fastify exposes
 * `req.routeOptions.url` (e.g. `/api/v1/trips/:id/overview`). Using
 * the raw path would explode label cardinality on any id-bearing
 * route. When the route is unmatched (404s on unrouted paths), we
 * label `unknown` to keep cardinality bounded against random
 * scanner traffic.
 *
 * Excludes `/metrics` from itself — recording the scrape's own
 * latency would create a recursive feedback loop and inflate the
 * histogram with self-traffic.
 *
 * Installed by prompt [IV.18.10.8].
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MetricsService } from './metrics.service';

const START_TIME_SYMBOL = Symbol.for('travel:http-metrics-start');

interface RequestWithStartTime extends FastifyRequest {
  [START_TIME_SYMBOL]?: bigint;
}

export async function registerHttpMetricsMiddleware(
  app: NestFastifyApplication,
  metrics: MetricsService,
): Promise<void> {
  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', async (req: FastifyRequest) => {
    (req as RequestWithStartTime)[START_TIME_SYMBOL] = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const start = (req as RequestWithStartTime)[START_TIME_SYMBOL];
    if (start === undefined) return;
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;

    const route = req.routeOptions?.url ?? 'unknown';
    if (route === '/metrics') return;

    metrics.recordHttp(req.method, route, reply.statusCode, durationSec);
  });
}
