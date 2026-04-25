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
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';
import { TypedRedisCache } from '../cache/typed-redis-cache';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

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
