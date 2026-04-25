/**
 * Process-wide Prometheus registry. Owns:
 *
 *   - `cache_hit_total{cache=<namespace>}`  — monotonic hit count
 *   - `cache_miss_total{cache=<namespace>}` — monotonic miss count
 *
 * Both metrics are implemented as `Gauge` rather than `Counter`
 * because the source of truth is the per-cache `hits` / `misses`
 * fields on `TypedRedisCache`, which we read via
 * `getStats()` at scrape time. A real `Counter` only supports
 * `.inc()`, not "set to a snapshot value", which would require
 * us to track a "last-sent delta" — extra plumbing for no
 * functional benefit. Prometheus's `rate()` works equally well
 * over a monotonic gauge as over a counter.
 *
 * Cardinality stays tiny: labels are bounded by the number of
 * registered caches (currently 6 — trip-balances + 5 TTL-only
 * providers). No user-derived labels, no IP labels, no anything
 * unbounded.
 *
 * Default Node process metrics (CPU, memory, event loop lag, GC)
 * are collected via `prom-client.collectDefaultMetrics` so the
 * `/metrics` endpoint surfaces them too — that's free
 * production-readiness baseline.
 *
 * Installed by prompt [IV.18.10.6].
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { TypedRedisCache } from '../cache/typed-redis-cache';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;
  private domainEventsCounter!: Counter<'event'>;
  private httpDurationHistogram!: Histogram<'method' | 'route' | 'status'>;

  constructor() {
    this.registry = new Registry();
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });

    new Gauge({
      name: 'cache_hit_total',
      help: 'Cumulative cache-hit count since process start, per registered cache namespace.',
      labelNames: ['cache'],
      registers: [this.registry],
      collect() {
        for (const cache of TypedRedisCache.getAllInstances()) {
          const { namespace, hits } = cache.getStats();
          this.labels(namespace).set(hits);
        }
      },
    });

    new Gauge({
      name: 'cache_miss_total',
      help: 'Cumulative cache-miss count since process start, per registered cache namespace. Includes both empty-key and Redis-outage paths.',
      labelNames: ['cache'],
      registers: [this.registry],
      collect() {
        for (const cache of TypedRedisCache.getAllInstances()) {
          const { namespace, misses } = cache.getStats();
          this.labels(namespace).set(misses);
        }
      },
    });

    // Real Counter (not Gauge) for domain events: each publish is
    // a discrete `inc()` at the EventBus seam, so the prom-client
    // Counter contract maps perfectly. Cardinality bounded by the
    // distinct event-name catalog (~10 events today: Identity.*,
    // Trip.*, Safety.*, etc.). Added by `[IV.18.10.7]`.
    this.domainEventsCounter = new Counter({
      name: 'domain_events_total',
      help: 'Cumulative count of domain events published, per event name.',
      labelNames: ['event'],
      registers: [this.registry],
    });

    // HTTP request duration histogram. Bucket boundaries cover the
    // SLO range from playbook §11: p95 < 300ms reads, < 800ms AI
    // endpoints. We add buckets above for tail visibility (slow DB
    // queries, lagging upstreams). Method × route × status keeps
    // cardinality bounded — `route` is the matched template (e.g.
    // `/trips/:id/overview`), NOT the raw path, so a million
    // distinct trip ids don't explode the metric.
    // Added by `[IV.18.10.8]`.
    this.httpDurationHistogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds, labeled by method/route/status.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  /**
   * Increment `domain_events_total{event=<name>}`. Called by the
   * MetricsRecordingEventBus decorator on every publish. No-op
   * before `onModuleInit` has wired the counter (e.g., during
   * test module construction); a real publish in that window is
   * not observable but also not harmful.
   *
   * Added by `[IV.18.10.7]`.
   */
  recordEvent(eventName: string): void {
    this.domainEventsCounter?.labels(eventName).inc();
  }

  /**
   * Record one HTTP request's duration. Called by the Fastify
   * onResponse hook (`http-metrics.middleware.ts`). Duration is
   * in seconds (Prometheus convention; the histogram buckets are
   * second-scale).
   *
   * `route` is the matched route template — e.g.
   * `/api/v1/trips/:id/overview`. Falls back to `unknown` when
   * Fastify couldn't resolve the route (404s on unrouted paths).
   * That keeps cardinality bounded against random scanner traffic.
   *
   * Added by `[IV.18.10.8]`.
   */
  recordHttp(method: string, route: string, status: number, durationSec: number): void {
    this.httpDurationHistogram?.labels(method, route, String(status)).observe(durationSec);
  }

  /** Renders the current scrape as Prometheus text-format. */
  async render(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type the controller should set on the response. */
  contentType(): string {
    return this.registry.contentType;
  }
}
