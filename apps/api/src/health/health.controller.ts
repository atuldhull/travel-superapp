/**
 * Health probes for Fly.io / Kubernetes / load balancers.
 *
 *   • GET /health/live     — process is up; no dep checks. Liveness probe.
 *   • GET /health/ready    — Postgres + Redis + Meilisearch reachable.
 *                           Returns 503 if any hard dep is down. Used as
 *                           the gate before LBs send traffic.
 *   • GET /health/startup  — app booted past its warm-up window. Cheap.
 *
 * Note on scope: the Playbook names ai-service as a /ready dependency
 * too, but ai-service (apps/ai-service) has not been built yet. The
 * terminus check is wired behind a startup switch — when AI_SERVICE_URL
 * points at a live ai-service AND `FEATURE_AI_SERVICE_HEALTH_CHECK` flips
 * on (added later with the ai-service prompt), the check becomes active
 * without a code change. Until then it's omitted from /ready.
 *
 * Route prefix: main.ts excludes `health/*` from the `/api/v1` global
 * prefix so probes hit the bare path.
 *
 * Installed by [III.11.0] (bare /live) + [IV.18.1.16] (/ready + /startup).
 */
import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import type { Env } from '@app/config';
import { Public } from '../common/auth';
import { HttpPingIndicator } from './indicators/http-ping.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';

// Health probes (k8s / Fly.io / LB) MUST NOT be rate-limited — they
// probe every second or so; a rate limit would flip pods to Unhealthy
// every time the bucket fills.
// Probes are not authenticated — LBs can't present JWTs.
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PostgresHealthIndicator) private readonly postgres: PostgresHealthIndicator,
    @Inject(RedisHealthIndicator) private readonly redis: RedisHealthIndicator,
    @Inject(HttpPingIndicator) private readonly http: HttpPingIndicator,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('live')
  live(): HealthLiveResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    const meiliHost = this.config.get('MEILI_HOST', { infer: true });
    return this.health.check([
      () => this.postgres.isHealthy(),
      () => this.redis.isHealthy(),
      () => this.http.isHealthy('meilisearch', `${meiliHost.replace(/\/$/, '')}/health`),
    ]);
  }

  @Get('startup')
  @HealthCheck()
  startup(): Promise<HealthCheckResult> {
    // Startup probe = "bootstrap finished, DB reachable". Once Prisma
    // lands (a later prompt), this check also asserts that all migrations
    // in `_prisma_migrations` have `applied_steps_count = migration_steps`.
    return this.health.check([() => this.postgres.isHealthy()]);
  }
}

export interface HealthLiveResponse {
  readonly status: 'ok';
  readonly service: 'api';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}
