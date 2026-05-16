/**
 * Agent HTTP surface.
 *
 *   GET  /api/v1/agent/status                     skeleton probe
 *   GET  /api/v1/agent/runs/:id                   run + step log
 *   POST /api/v1/agent/proposals/:id/accept       human-in-the-loop
 *   POST /api/v1/agent/proposals/:id/decline      human-in-the-loop
 *
 * Every route 503s `AGENT_DISABLED` when FEATURE_AGENT_ENABLED is
 * off. Accept/decline are the ONLY way a proposal takes effect — the
 * agent never acts autonomously (LAW 2). Authenticated like every
 * business route.
 *
 * Installed by [POST.2A.1]; runs+proposals by [POST.2A.4].
 */
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import type { AgentRun } from '../domain/agent-run.entity';
import type { AgentStep } from '../domain/agent-step.entity';
import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../application/ports/agent-run.repository';
import {
  ConfirmReplanUseCase,
  type ConfirmReplanResult,
} from '../application/confirm-replan.use-case';

export interface AgentStatusDto {
  readonly enabled: true;
  readonly phase: string;
}

export interface AgentRunDto {
  readonly run: AgentRun;
  readonly steps: readonly AgentStep[];
}

@ApiTags('agent')
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  private readonly logger: AppLogger = createLogger('agent.controller');

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
    @Inject(ConfirmReplanUseCase) private readonly confirm: ConfirmReplanUseCase,
  ) {}

  /** 503 with a stable code when the agent feature is off. */
  private requireAgent(): void {
    if (!this.config.get('FEATURE_AGENT_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException({
        code: 'AGENT_DISABLED',
        message: 'The trip agent is not enabled in this environment.',
      });
    }
  }

  @ApiOperation({
    summary: 'Agent probe — 503 (AGENT_DISABLED) when FEATURE_AGENT_ENABLED is off.',
  })
  @Get('status')
  status(): AgentStatusDto {
    this.requireAgent();
    this.logger.debug({}, 'agent_status_probe');
    return { enabled: true, phase: 'Phase A (POST.2A.4)' };
  }

  @ApiOperation({ summary: 'An agent run + its append-only step log.' })
  @ApiParam({ name: 'id', description: 'AgentRun id' })
  @ApiResponse({ status: 404, description: 'AGENT_RUN_NOT_FOUND' })
  @Get('runs/:id')
  async getRun(@Param('id') id: string): Promise<AgentRunDto> {
    this.requireAgent();
    const run = await this.runs.findById(id);
    if (!run) {
      throw new NotFoundException({ code: 'AGENT_RUN_NOT_FOUND', message: 'Agent run not found.' });
    }
    return { run, steps: await this.runs.listSteps(id) };
  }

  @ApiOperation({ summary: 'Accept a proposed re-plan (human-in-the-loop; never autonomous).' })
  @ApiParam({ name: 'id', description: 'Proposal (AgentStep) id' })
  @ApiResponse({ status: 404, description: 'AGENT_PROPOSAL_NOT_FOUND' })
  @Post('proposals/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConfirmReplanResult> {
    this.requireAgent();
    return this.confirm.execute({ proposalId: id, decision: 'accept', userId: user.sub });
  }

  @ApiOperation({ summary: 'Decline a proposed re-plan (raises the watch threshold).' })
  @ApiParam({ name: 'id', description: 'Proposal (AgentStep) id' })
  @ApiResponse({ status: 404, description: 'AGENT_PROPOSAL_NOT_FOUND' })
  @Post('proposals/:id/decline')
  @HttpCode(HttpStatus.OK)
  declineProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConfirmReplanResult> {
    this.requireAgent();
    return this.confirm.execute({ proposalId: id, decision: 'decline', userId: user.sub });
  }
}
