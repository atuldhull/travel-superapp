/**
 * [S-E5] Reject an agent's KYC.
 *
 * Sets Agent.kycStatus = 'rejected' + clears verifiedAt. Writes an
 * AdminAuditLog row (action='reject_agent') with the rejection reason
 * for posterity. Reason is required (1..280 chars; same shape as the
 * ban-user reason) — empty rejections are unhelpful to both the admin
 * audit trail and any future appeal flow.
 *
 * Installed by [S-E5] of the S-series real-functionality closeout.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  recordAdminAction,
  type AdminAuditLogRepository,
} from '../../admin';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';
import type { AgentProfile } from '../domain/agent-profile.entity';

const REASON_MIN = 1;
const REASON_MAX = 280;

export interface AdminRejectAgentCommand {
  readonly actorId: string;
  readonly agentId: string;
  readonly reason: string;
}

@Injectable()
export class AdminRejectAgentUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY) private readonly repo: AgentRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: AdminRejectAgentCommand): Promise<AgentProfile> {
    const reason = cmd.reason.trim();
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      throw new ValidationError(
        `Rejection reason must be ${REASON_MIN}..${REASON_MAX} characters`,
        { reason: [`Must be ${REASON_MIN}..${REASON_MAX} characters`] },
        { min: REASON_MIN, max: REASON_MAX },
        'INVALID_REJECTION_REASON',
      );
    }
    const updated = await this.repo.setKycStatus({
      agentId: cmd.agentId,
      kycStatus: 'rejected',
      verifiedAt: null,
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
      action: 'reject_agent',
      context: { displayName: updated.displayName, reason },
    });
    return updated;
  }
}
