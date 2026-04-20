import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../common/db/prisma.service';

const KEY = 'postgres';

/**
 * Postgres liveness probe for `/health/ready`. Runs `SELECT 1` through
 * `PrismaService` — same connection pool the request path uses, so a
 * probe "up" truly means "every incoming request can reach the DB".
 *
 * Pre-[III.12.2] this file carried its own `pg.Pool` because Prisma
 * wasn't wired yet. Swapped to the shared pool once `PrismaService`
 * landed — one pool, one source of truth, one metric surface.
 *
 * Installed by prompt [IV.18.1.16]; PrismaService-backed rewrite by
 * [III.12.x-health-cleanup].
 */
@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const started = Date.now();
    try {
      const rows = await this.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
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
}
