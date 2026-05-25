/**
 * V.UX.24 — composite read for the agent dashboard.
 *
 * One round-trip from the web layer surfaces:
 *   - Profile (id, KYC status, rating aggregates).
 *   - Bookings list (last `windowDays`, capped).
 *   - Earnings sum + count (same window).
 *   - Reviews list (recent, capped) — the agent responds inline.
 *
 * Window default 30 days; caller can override (1..365). All
 * sub-fetches go through `AgentRepository`, so a future split
 * across services only changes that adapter.
 *
 * Installed by prompt [V.UX.24].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import type {
  AgentBookingSummary,
  AgentEarningsSummary,
  AgentProfile,
  AgentReviewWithResponse,
} from '../domain/agent-profile.entity';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const BOOKINGS_LIMIT = 50;
const REVIEWS_LIMIT = 20;

export interface GetAgentDashboardCommand {
  readonly userId: string;
  readonly windowDays?: number;
}

export interface AgentDashboard {
  readonly profile: AgentProfile;
  readonly bookings: readonly AgentBookingSummary[];
  readonly earnings: AgentEarningsSummary;
  readonly reviews: readonly AgentReviewWithResponse[];
  readonly windowDays: number;
}

@Injectable()
export class GetAgentDashboardUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY) private readonly agents: AgentRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: GetAgentDashboardCommand): Promise<AgentDashboard> {
    const windowDays =
      cmd.windowDays === undefined
        ? DEFAULT_WINDOW_DAYS
        : Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.floor(cmd.windowDays)));
    if (cmd.windowDays !== undefined && !Number.isFinite(cmd.windowDays)) {
      throw new ValidationError(
        'windowDays must be a finite number',
        { windowDays: ['out of range'] },
        { windowDays: cmd.windowDays },
        'INVALID_DASHBOARD_WINDOW',
      );
    }

    const profile = await this.agents.findByUserId(cmd.userId);
    if (!profile) {
      throw new NotFoundError(
        'Agent profile not found',
        { userId: cmd.userId },
        'AGENT_PROFILE_NOT_FOUND',
      );
    }

    const since = new Date(this.clock.nowMs() - windowDays * 86_400_000);
    const [bookings, earnings, reviews] = await Promise.all([
      this.agents.listBookingsForAgent({
        agentId: profile.id,
        since,
        limit: BOOKINGS_LIMIT,
      }),
      this.agents.sumEarningsForAgent({ agentId: profile.id, since }),
      this.agents.listReviewsForAgent({ agentId: profile.id, limit: REVIEWS_LIMIT }),
    ]);

    return { profile, bookings, earnings, reviews, windowDays };
  }
}
