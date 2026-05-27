/**
 * [S-E5] Verify an agent's KYC.
 *
 * Flips Agent.kycStatus to 'verified' + stamps verifiedAt = clock.now().
 * Writes an AdminAuditLog row (`action='verify_agent'`) attributed to
 * the admin actor. The Slack notifier ([S-E6]) wires `verify_agent`
 * into the PING_ACTIONS set so ops see it land.
 *
 * Rejection / re-pending lives in the sibling reject use-case to keep
 * the call sites obvious.
 *
 * Installed by [S-E5] of the S-series real-functionality closeout.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  recordAdminAction,
  type AdminAuditLogRepository,
} from '../../admin';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';
import type { AgentProfile } from '../domain/agent-profile.entity';

export interface AdminVerifyAgentCommand {
  readonly actorId: string;
  readonly agentId: string;
}

@Injectable()
export class AdminVerifyAgentUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY) private readonly repo: AgentRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: AdminVerifyAgentCommand): Promise<AgentProfile> {
    const now = this.clock.now();
    const updated = await this.repo.setKycStatus({
      agentId: cmd.agentId,
      kycStatus: 'verified',
      verifiedAt: now,
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'AGENT_NOT_FOUND',
        message: `Agent ${cmd.agentId} not found`,
      });
    }
    await recordAdminAction(this.audit, {
      actorId: cmd.actorId,
      targetType: 'agent',
      targetId: cmd.agentId,
      action: 'verify_agent',
      context: { displayName: updated.displayName, verifiedAt: now.toISOString() },
    });
    return updated;
  }
}
