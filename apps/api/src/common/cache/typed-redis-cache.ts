/**
 * Shared Redis cache base class. Extracts the get/set/ensureConnected
 * machinery that Weather + Stays + Food each had their own ~70-line
 * copy of.
 *
 * Each module-specific cache is now a ~10-line subclass that just
 * provides its namespace + logger name:
 *
 *   @Injectable()
 *   export class RedisWeatherCache
 *     extends TypedRedisCache<WeatherForecast>
 *     implements WeatherCache
 *   {
 *     constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
 *       super(config, 'weather', 'weather.cache');
 *     }
 *   }
 *
 * Design choices:
 *   - **Abstract class, not factory function**: NestJS DI resolves
 *     by class token, and inject-in-constructor is the native path.
 *     A factory would force every consumer to use `{ provide: X,
 *     useFactory: ... }` — more ceremony.
 *   - **Own ioredis client per instance**: mirrors the isolated
 *     failure domain pattern `RedisThrottlerStorage` uses. A shared
 *     client would couple cache invalidation across unrelated
 *     namespaces.
 *   - **Swallow-and-log on failure**: a dead cache degrades to
 *     "no cache" (the caller returns the fresh value). Propagating
 *     would make a Redis outage take down the consumer endpoint.
 *   - **`ensureConnected()` guard**: `lazyConnect: true` +
 *     `enableOfflineQueue: false` means commands fail instantly
 *     until status leaves `wait`/`end`/`close`. Same trick
 *     `RedisThrottlerStorage` uses.
 *   - **Lives in `common/cache/`, not `@app/cache`**: no second app
 *     needs this yet. Promote to a workspace package when
 *     `notification-worker` or `crawler-worker` grow a cache, which
 *     is not today.
 *
 * Installed by prompt [IV.18.8.1].
 */
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';

type PinoLogger = ReturnType<typeof createLogger>;

/**
 * Per-instance hit/miss counters + the cache's namespace label,
 * surfaced for observability. A future `/metrics` controller (the
 * prom-client swap noted in `[IV.18.10.5]`) iterates the registered
 * caches and emits `cache_hit_total{cache=<namespace>}` from these
 * counters; until then, ops can pivot the structured `cache_hit` /
 * `cache_miss` log events in Loki / Grafana.
 *
 * Numbers are monotonic since process start; the metrics collector
 * is responsible for rate-converting if needed.
 */
export interface CacheStats {
  readonly namespace: string;
  readonly hits: number;
  readonly misses: number;
}

export abstract class TypedRedisCache<T> implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private hits = 0;
  private misses = 0;
  protected readonly namespace: string;
  protected readonly log: PinoLogger;

  protected constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    namespace: string,
    loggerName: string,
  ) {
    this.namespace = namespace;
    this.log = createLogger(loggerName);
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      this.log.warn({ err: err.message }, `${namespace}_cache_redis_error`);
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:${namespace}:`;
  }

  /**
   * Read-only snapshot of the per-instance hit/miss counters.
   * Public so a future `/metrics` controller can roll them up
   * across every registered cache. The numbers are monotonic
   * counts since process start; rate-conversion is the
   * collector's job. Added by `[IV.18.10.5]`.
   */
  getStats(): CacheStats {
    return { namespace: this.namespace, hits: this.hits, misses: this.misses };
  }

  private async ensureConnected(): Promise<void> {
    if (
      this.redis.status === 'wait' ||
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      await this.redis.connect();
    }
  }

  async get(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();
      const raw = await this.redis.get(this.keyPrefix + key);
      if (!raw) {
        // Treat absent values + Redis outages identically: both
        // count as miss + force the caller's fresh-read path.
        // Outages are already surfaced via the `<namespace>_cache_redis_error`
        // log channel; double-counting them as misses here would
        // skew the hit-ratio metric in a way that doesn't reflect
        // the question we want to answer ("is the cache populated
        // when consumers ask?").
        this.misses++;
        this.log.debug({ namespace: this.namespace, key }, 'cache_miss');
        return null;
      }
      this.hits++;
      this.log.debug({ namespace: this.namespace, key }, 'cache_hit');
      return JSON.parse(raw) as T;
    } catch (err) {
      this.misses++;
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${this.namespace}_cache_get_failed`,
      );
      return null;
    }
  }

  async set(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(this.keyPrefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${this.namespace}_cache_set_failed`,
      );
    }
  }

  /**
   * Invalidate a cached key. No-op when the key is absent.
   * Used by write paths whose freshness contract requires the
   * next read to bypass the cache (e.g. trip-balances after an
   * expense write — `[IV.18.10.4]`). Most cache consumers are
   * TTL-only and never call this.
   *
   * Swallows on failure: a cache invalidation failure is
   * recoverable on the next TTL expiry; we don't want to fail
   * the originating write because Redis is down.
   *
   * Added by `[IV.18.10.4]`.
   */
  async del(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.del(this.keyPrefix + key);
    } catch (err) {
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${this.namespace}_cache_del_failed`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // quit may race with connection-failed state; don't block shutdown.
    }
  }
}
