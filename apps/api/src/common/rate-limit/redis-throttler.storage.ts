import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import Redis from 'ioredis';

/** Shape `@nestjs/throttler` requires `increment` to return. Inlined
 *  because it lives in an unindexed sub-path in v6's package. */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const log = createLogger('ratelimit.redis');

/**
 * Redis sliding-window rate-limit storage backing `@nestjs/throttler`.
 *
 * Algorithm: each (throttler, tracker) key is a sorted set in Redis.
 * Every request ZADDs its timestamp; old entries (outside the window)
 * are trimmed with ZREMRANGEBYSCORE; ZCARD returns the current count.
 * The whole thing is one atomic Lua call so count + trim + insert
 * can't race.
 *
 * Keys are peppered (`RATE_LIMIT_PEPPER`) so raw identifiers — IPs,
 * emails, userIds — never sit in Redis in plaintext (Playbook §13.4).
 *
 * Installed by prompt [III.11.4].
 */

/**
 * Sliding-window Lua. Returns `[count, timeToExpire_ms]`.
 *
 *   KEYS[1] = full Redis key
 *   ARGV[1] = now (ms since epoch)
 *   ARGV[2] = ttl (ms)
 *   ARGV[3] = unique id for the ZSET member (tie-breaker at the same ms)
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local uid = ARGV[3]
local cutoff = now - ttl
redis.call('ZREMRANGEBYSCORE', key, '-inf', '(' .. cutoff)
redis.call('ZADD', key, now, uid)
local count = redis.call('ZCARD', key)
redis.call('PEXPIRE', key, ttl + 1000)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local time_to_expire = 0
if #oldest >= 2 then
  time_to_expire = tonumber(oldest[2]) + ttl - now
end
return { count, time_to_expire }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly pepper: string;
  private readonly keyPrefix: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'ratelimit_redis_error');
    });
    this.pepper = config.get('RATE_LIMIT_PEPPER', { infer: true });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:throttle:`;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `${this.keyPrefix}${throttlerName}:${this.hash(key)}`;
    const now = Date.now();
    const uid = `${now}-${randomUUID()}`;

    if (
      this.redis.status === 'end' ||
      this.redis.status === 'close' ||
      this.redis.status === 'wait'
    ) {
      await this.redis.connect();
    }

    const result = (await this.redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      fullKey,
      String(now),
      String(ttl),
      uid,
    )) as [number | string, number | string];

    const totalHits = Number(result[0]);
    const timeToExpire = Math.max(0, Number(result[1]));
    const isBlocked = totalHits > limit;
    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }

  /**
   * `sha256(pepper + key)` — irreversible, fixed-length, collision-safe
   * at our volumes. Caller-supplied keys are small ("127.0.0.1",
   * `user:<cuid>`, endpoint-class names); the hash is O(1).
   */
  private hash(key: string): string {
    return createHash('sha256').update(this.pepper).update(':').update(key).digest('hex');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'ratelimit_redis_close_failed',
      );
    }
  }
}
