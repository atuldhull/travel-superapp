import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import Redis from 'ioredis';

const log = createLogger('health.redis');

const KEY = 'redis';
const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: CHECK_TIMEOUT_MS,
      commandTimeout: CHECK_TIMEOUT_MS,
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => {
      log.warn({ err: err.message }, 'redis_client_error');
    });
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const started = Date.now();
    try {
      if (
        this.client.status === 'end' ||
        this.client.status === 'close' ||
        this.client.status === 'wait'
      ) {
        await this.client.connect();
      }
      const pong = await this.client.ping();
      const latencyMs = Date.now() - started;
      const ok = pong === 'PONG';
      const result = this.getStatus(KEY, ok, { latencyMs });
      if (!ok) {
        throw new HealthCheckError('redis PING did not return PONG', result);
      }
      return result;
    } catch (err) {
      const latencyMs = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      throw new HealthCheckError(
        'redis unreachable',
        this.getStatus(KEY, false, { latencyMs, error: message }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'redis_client_close_failed',
      );
    }
  }
}
