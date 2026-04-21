/**
 * Redis-backed FailedLoginCounter. Simple INCR + EXPIRE pattern —
 * the counter is a fixed-window (not a sliding window) for
 * simplicity. Fixed-window is fine here because the window is
 * per-identity, not per-IP; the only failure mode is a legitimate
 * user happening to type their password wrong 5 times across a
 * 15-minute boundary, which would erroneously NOT lock them out
 * on the 5th attempt straddling the boundary. That's acceptable —
 * we're not trying to mathematically prove credential stuffing
 * won't succeed, we're raising the cost.
 *
 * Key shape: `travel-<env>:login-fail:<sha256(pepper + emailHash)>`.
 * The emailHash passed in is already peppered by `email-hash.ts`,
 * but we re-pepper here with RATE_LIMIT_PEPPER so the login-fail
 * counter doesn't share a key space with any other emailHash
 * lookup (defence-in-depth — a Redis-only compromise can't cross-
 * reference with the DB).
 *
 * Installed by prompt [IV.18.2.6].
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import Redis from 'ioredis';
import type {
  FailedLoginCounter,
  FailedLoginRecord,
} from '../application/ports/failed-login-counter';

const log = createLogger('identity.login-fail');

/**
 * Window for the failed-login counter. 15 minutes — matches the
 * OWASP ASVS v4 v2.2.1 guidance: short enough that legitimate
 * users don't get locked out for mistyping across coffee breaks,
 * long enough that automated credential-stuffing pauses have to
 * span ≥15 min to escape detection.
 */
export const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class RedisFailedLoginCounter implements FailedLoginCounter, OnModuleDestroy {
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
      log.warn({ err: err.message }, 'login_fail_redis_error');
    });
    this.pepper = config.get('RATE_LIMIT_PEPPER', { infer: true });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:login-fail:`;
  }

  async get(emailHash: string): Promise<FailedLoginRecord> {
    await this.ensureConnected();
    const key = this.keyFor(emailHash);
    const pipeline = this.redis.multi().get(key).pttl(key);
    const results = (await pipeline.exec()) as Array<[Error | null, string | number | null]>;
    const [countRes, ttlRes] = results;
    const rawCount = countRes?.[1];
    const rawTtl = ttlRes?.[1];
    const count = typeof rawCount === 'string' ? Number(rawCount) : 0;
    // PTTL returns -2 when key doesn't exist, -1 when no TTL set.
    const ttlMs = typeof rawTtl === 'number' && rawTtl > 0 ? rawTtl : 0;
    return { count: Number.isFinite(count) ? count : 0, ttlMs };
  }

  async increment(emailHash: string): Promise<FailedLoginRecord> {
    await this.ensureConnected();
    const key = this.keyFor(emailHash);
    // INCR + PEXPIRE NX: set the window on the first failure,
    // leave the existing TTL on subsequent failures (fixed window).
    const pipeline = this.redis
      .multi()
      .incr(key)
      .pexpire(key, FAILED_LOGIN_WINDOW_MS, 'NX')
      .pttl(key);
    const results = (await pipeline.exec()) as Array<[Error | null, number]>;
    const count = results[0]?.[1] ?? 0;
    const ttlMs = results[2]?.[1] ?? FAILED_LOGIN_WINDOW_MS;
    return { count, ttlMs: ttlMs > 0 ? ttlMs : FAILED_LOGIN_WINDOW_MS };
  }

  async reset(emailHash: string): Promise<void> {
    await this.ensureConnected();
    await this.redis.del(this.keyFor(emailHash));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end' && this.redis.status !== 'close') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }

  private async ensureConnected(): Promise<void> {
    if (
      this.redis.status === 'end' ||
      this.redis.status === 'close' ||
      this.redis.status === 'wait'
    ) {
      await this.redis.connect();
    }
  }

  private keyFor(emailHash: string): string {
    const salted = createHash('sha256')
      .update(this.pepper + emailHash, 'utf8')
      .digest('hex');
    return `${this.keyPrefix}${salted}`;
  }
}
