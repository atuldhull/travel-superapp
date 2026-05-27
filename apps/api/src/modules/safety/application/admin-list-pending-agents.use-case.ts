/**
 * [S-E5] List agents pending KYC for the admin moderation queue.
 *
 * Filter by status (default `pending` since that's the queue's primary
 * use). Verified / rejected piles available via `status` arg so the
 * admin UI can offer the same surface for "already verified" and
 * "already rejected" tabs.
 *
 * Installed by [S-E5] of the S-series real-functionality closeout.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';
import type { AgentProfile } from '../domain/agent-profile.entity';

export interface AdminListPendingAgentsQuery {
  readonly status?: 'pending' | 'verified' | 'rejected';
  readonly limit?: number;
  readonly offset?: number;
}

export interface AdminListPendingAgentsResult {
  readonly agents: readonly AgentProfile[];
  readonly total: number;
}

@Injectable()
export class AdminListPendingAgentsUseCase {
  constructor(@Inject(AGENT_REPOSITORY) private readonly repo: AgentRepository) {}

  execute(query: AdminListPendingAgentsQuery): Promise<AdminListPendingAgentsResult> {
    return this.repo.listByKycStatus({
      kycStatus: query.status ?? 'pending',
      limit: Math.min(Math.max(query.limit ?? 50, 1), 200),
      offset: Math.max(query.offset ?? 0, 0),
    });
  }
}
