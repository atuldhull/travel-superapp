/**
 * V.UX.10 anonymous "❤️ this trip" counter. Redis-backed; single
 * `INCR`/`GET` per call. Keyed by tripId — public anonymous reactions
 * accumulate per trip, not per user / per share-code (the same trip
 * may have many active share codes pointing at it).
 *
 * Per-IP rate-limiting is enforced at the route level via
 * `@Throttle({ default: { limit: 1, ttl: 60_000 } })`.
 *
 * No TTL — hearts are durable counts.
 *
 * POST.2B.1 note: the block guard is intentionally NOT applied here.
 * Hearts are ANONYMOUS — `HeartSharedTripUseCase.execute(shareCode)`
 * carries no actor identity, so there is no "blocked pair" to gate
 * (verified-reality-overrides-prompt-wording; the block guard lives
 * on the actor-bearing paths: follow / vote / review).
 *
 * Installed by prompt [V.UX.10].
 */
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';

const log = createLogger('social.heart-counter');

@Injectable()
export class TripHeartCounter implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'heart_counter_redis_error');
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:trip-hearts:`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => {});
  }

  private key(tripId: string): string {
    return `${this.keyPrefix}${tripId}`;
  }

  async increment(tripId: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.incr(this.key(tripId));
  }

  async get(tripId: string): Promise<number> {
    await this.ensureConnected();
    const value = await this.redis.get(this.key(tripId));
    return value ? Number(value) : 0;
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
}
