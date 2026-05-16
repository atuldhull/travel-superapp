/**
 * POST.2A.1 — agent HTTP surface (skeleton).
 *
 *   GET /api/v1/agent/status
 *     200 → { enabled: true, phase }  when FEATURE_AGENT_ENABLED
 *     503 → AGENT_DISABLED             otherwise
 *
 * This slice ships NO behaviour beyond the probe above. The gate
 * mirrors the PaymentsController pattern exactly (ServiceUnavailable
 * with a stable `code`) so the agent stays inert until POST.2A.2..5
 * land the loop. Authenticated like every business route — infra
 * probes live under `/health/*`, not here.
 *
 * Installed by prompt [POST.2A.1].
 */
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';

export interface AgentStatusDto {
  readonly enabled: true;
  readonly phase: string;
}

@ApiTags('agent')
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  private readonly logger: AppLogger = createLogger('agent.controller');

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  /**
   * Throws 503 with a stable machine code when the agent feature is
   * off. Every future agent route calls this first.
   */
  private requireAgent(): void {
    if (!this.config.get('FEATURE_AGENT_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException({
        code: 'AGENT_DISABLED',
        message: 'The trip agent is not enabled in this environment.',
      });
    }
  }

  @ApiOperation({
    summary: 'Agent skeleton probe — 503 (AGENT_DISABLED) when FEATURE_AGENT_ENABLED is off.',
  })
  @Get('status')
  status(): AgentStatusDto {
    this.requireAgent();
    this.logger.debug({}, 'agent_status_probe');
    return { enabled: true, phase: 'skeleton (POST.2A.1)' };
  }
}
