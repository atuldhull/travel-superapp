/**
 * Minimal `/health/live` probe for Fly.io / k8s / load balancers.
 *
 * Intentionally simple — this endpoint signals "the process is up and
 * the HTTP server is reachable", nothing more. The richer `/health/ready`
 * + `/health/startup` endpoints (checking Postgres, Redis, ai-service,
 * Meilisearch) land in prompt **[IV.18.1.16]** via `@nestjs/terminus`.
 *
 * Route is mounted at `/health/live` (not `/api/v1/health/live`) because
 * main.ts excludes `health/*` from the global `/api/v1` prefix — probes
 * typically hit the bare path.
 *
 * Installed by prompt [III.11.0].
 */
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live(): HealthLiveResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

export interface HealthLiveResponse {
  readonly status: 'ok';
  readonly service: 'api';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}
