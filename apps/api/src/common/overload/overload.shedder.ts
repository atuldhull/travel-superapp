/**
 * Load shedding ([O2]).
 *
 * A Fastify onRequest hook that REJECTS new requests with HTTP 503
 * when the process is overloaded — defined as either:
 *
 *   1. Event-loop lag has crossed `EVENT_LOOP_LAG_MS` ms over the
 *      sampling window, OR
 *   2. The in-flight request count is at `MAX_IN_FLIGHT`.
 *
 * Why shed instead of queue: queued requests still hold their client
 * timeout. If the api is melting, every queued request is a future
 * 502 from a circuit breaker upstream — so it's cheaper for everyone
 * to fail fast at the edge.
 *
 * Two health-bypass invariants are critical (verified by the unit
 * spec next to this file):
 *
 *   A. `/health/*` requests NEVER shed. The orchestrator needs the
 *      probe to tell it the process is unhealthy; shedding the probe
 *      would actually make Fly think the machine was MORE healthy
 *      than reality.
 *   B. `/metrics` NEVER sheds. Prometheus scraping during overload is
 *      exactly when we need the data MOST.
 *
 * Implementation notes:
 *
 * - `monitorEventLoopDelay` is a Node `perf_hooks` primitive that
 *   uses a histogram (low-overhead). We sample its `.mean` every
 *   500ms and decide on the most recent window.
 * - The in-flight counter is incremented in `onRequest` and
 *   decremented in `onResponse` + `onError` (Fastify guarantees one
 *   onResponse OR onError per onRequest).
 * - The 503 response includes a `retry-after: 1` header to nudge
 *   clients into a brief backoff.
 *
 * Installed by [O2].
 */
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@app/logger';

const log = createLogger('overload');

export interface OverloadShedderOptions {
  /** Threshold for event-loop lag mean (ms). Default 100. */
  readonly eventLoopLagMs?: number;
  /** Concurrent in-flight cap. Default 200. */
  readonly maxInFlight?: number;
  /** Lag sampler interval (ms). Default 500. */
  readonly samplerMs?: number;
  /** Path prefixes that NEVER shed. Default = health + metrics. */
  readonly bypassPrefixes?: readonly string[];
}

const DEFAULTS = {
  eventLoopLagMs: 100,
  maxInFlight: 200,
  samplerMs: 500,
  bypassPrefixes: ['/health/', '/api/v1/health/', '/metrics'],
} satisfies Required<OverloadShedderOptions>;

interface OverloadState {
  /** Latest sampled event-loop lag mean in ms. */
  meanLagMs: number;
  /** Live in-flight count. */
  inFlight: number;
  /** Cumulative shed count — surfaced via getStats(). */
  shed: number;
}

/**
 * Pure decision — exported for unit-testability. Returns the reason
 * to shed, or `null` when the request should be served. The Fastify
 * hook just calls this + replies appropriately.
 */
export function shouldShed(
  state: Readonly<OverloadState>,
  opts: Required<OverloadShedderOptions>,
  path: string,
): { reason: 'event_loop_lag' | 'in_flight_cap'; detail: number } | null {
  for (const prefix of opts.bypassPrefixes) {
    if (path === prefix.replace(/\/$/, '') || path.startsWith(prefix)) return null;
  }
  if (state.meanLagMs >= opts.eventLoopLagMs) {
    return { reason: 'event_loop_lag', detail: state.meanLagMs };
  }
  if (state.inFlight >= opts.maxInFlight) {
    return { reason: 'in_flight_cap', detail: state.inFlight };
  }
  return null;
}

/**
 * Wire the load-shedder into a Fastify app. Registers an `onRequest`
 * hook (decides), `onResponse` + `onError` hooks (decrement counter),
 * and a sampler interval. Exposes `getStats()` for the Prometheus
 * MetricsService to roll up.
 */
export function registerOverloadShedder(
  app: FastifyInstance,
  opts: OverloadShedderOptions = {},
): { getStats(): OverloadState; close(): void } {
  const resolved: Required<OverloadShedderOptions> = {
    eventLoopLagMs: opts.eventLoopLagMs ?? DEFAULTS.eventLoopLagMs,
    maxInFlight: opts.maxInFlight ?? DEFAULTS.maxInFlight,
    samplerMs: opts.samplerMs ?? DEFAULTS.samplerMs,
    bypassPrefixes: opts.bypassPrefixes ?? DEFAULTS.bypassPrefixes,
  };

  const state: OverloadState = { meanLagMs: 0, inFlight: 0, shed: 0 };

  const histogram: IntervalHistogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const sampler = setInterval(() => {
    // `histogram.mean` is in nanoseconds; convert to ms.
    state.meanLagMs = histogram.mean / 1_000_000;
    histogram.reset();
  }, resolved.samplerMs);
  // The sampler is process-lifetime; don't pin the event loop alive
  // solely for it (so a fresh `app.close()` in tests can exit).
  sampler.unref?.();

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const decision = shouldShed(state, resolved, req.url);
    if (decision) {
      state.shed += 1;
      log.warn(
        { reason: decision.reason, detail: decision.detail, url: req.url },
        'request_shed_overload',
      );
      reply.header('retry-after', '1');
      reply.code(503).send({
        code: 'OVERLOADED',
        message: 'Server is overloaded; please retry in a moment',
        reason: decision.reason,
      });
      return;
    }
    state.inFlight += 1;
  });

  // Decrement on EITHER onResponse or onError — Fastify guarantees
  // exactly one of these fires per onRequest that didn't reply.
  const dec = async (): Promise<void> => {
    if (state.inFlight > 0) state.inFlight -= 1;
  };
  app.addHook('onResponse', dec);
  app.addHook('onError', dec);

  return {
    getStats: (): OverloadState => ({ ...state }),
    close: (): void => {
      clearInterval(sampler);
      histogram.disable();
    },
  };
}
