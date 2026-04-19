import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import { Pool } from 'pg';

const log = createLogger('health.postgres');

const KEY = 'postgres';
const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class PostgresHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: 1,
      idleTimeoutMillis: CHECK_TIMEOUT_MS,
      connectionTimeoutMillis: CHECK_TIMEOUT_MS,
    });
    this.pool.on('error', (err) => {
      log.warn({ err: err.message }, 'postgres_pool_error');
    });
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const started = Date.now();
    try {
      const { rows } = await this.pool.query<{ ok: number }>('SELECT 1 AS ok');
      const ok = rows[0]?.ok === 1;
      const latencyMs = Date.now() - started;
      const result = this.getStatus(KEY, ok, { latencyMs });
      if (!ok) {
        throw new HealthCheckError('postgres SELECT 1 did not return 1', result);
      }
      return result;
    } catch (err) {
      const latencyMs = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      throw new HealthCheckError(
        'postgres unreachable',
        this.getStatus(KEY, false, { latencyMs, error: message }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch((err: unknown) => {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'postgres_pool_close_failed',
      );
    });
  }
}
