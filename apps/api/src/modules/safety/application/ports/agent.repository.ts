/**
 * V.UX.17 — port for the verified-agent read surface. Narrow v1: a
 * single `findVerifiedMatches` query that returns top-rated agents,
 * optionally filtered by region (case-insensitive exact match on
 * any string in the agent's `regions` array).
 *
 * Lives under the safety module per the V.UX.17 prompt's scope-lock,
 * even though "concierge marketplace" is conceptually a separate
 * bounded context — keeps the agent surface co-located with the
 * existing agent KYC scaffolding (Agent.kycStatus + Agent.verifiedAt
 * are part of the safety / trust domain).
 *
 * Installed by prompt [V.UX.17].
 */
import type { AgentMatch } from '../../domain/agent-match.entity';
import type {
  AgentBookingSummary,
  AgentEarningsSummary,
  AgentProfile,
  AgentReviewWithResponse,
} from '../../domain/agent-profile.entity';

export interface FindVerifiedMatchesInput {
  /**
   * Optional region filter (case-insensitive exact match on any
   * `Agent.regions` entry). Undefined / empty = no filter, return
   * the highest-rated verified agents globally.
   */
  readonly region?: string;
  /** Cap on result count. Use-case clamps to [1, 10]. */
  readonly limit: number;
}

export interface UpdateAgentProfileInput {
  readonly userId: string;
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly languages?: readonly string[];
  readonly regions?: readonly string[];
}

export interface AgentRepository {
  /**
   * Returns up to `limit` verified-only agent rows ordered by
   * `ratingAverage DESC, ratingCount DESC, verifiedAt DESC`.
   * Filters: `kycStatus = 'verified' AND verifiedAt IS NOT NULL`,
   * plus optional region match.
   */
  findVerifiedMatches(input: FindVerifiedMatchesInput): Promise<readonly AgentMatch[]>;

  /**
   * V.UX.24 — caller-self read of the Agent row attached to this
   * `userId`. Returns null when the user hasn't been onboarded as
   * an agent yet (admins create the row in a separate flow).
   */
  findByUserId(userId: string): Promise<AgentProfile | null>;

  /**
   * V.UX.24 — partial update of editable Agent fields. Returns the
   * fresh row, or null when no Agent exists for this `userId`. Admin-
   * only fields (`kycStatus`, `verifiedAt`, `kycProviderRef`) are not
   * accepted by this surface; the agent persona edits their own
   * presentation data only.
   */
  updateForUser(input: UpdateAgentProfileInput): Promise<AgentProfile | null>;

  /**
   * V.UX.24 — bookings (EscrowHold rows) where this agent is the
   * fulfilment counterparty, newest first, capped by the use-case.
   * `since` filters createdAt >= `since` so the dashboard can ask for
   * "last 30 days".
   */
  listBookingsForAgent(input: {
    readonly agentId: string;
    readonly since: Date;
    readonly limit: number;
  }): Promise<readonly AgentBookingSummary[]>;

  /**
   * V.UX.24 — earnings sum + count over the same window. Excludes
   * `refunded` holds; `released` and `held` both count toward the
   * gross figure (the dashboard shows gross — net-of-platform-cut
   * lands when commission tracking matures).
   */
  sumEarningsForAgent(input: {
    readonly agentId: string;
    readonly since: Date;
  }): Promise<AgentEarningsSummary>;

  /**
   * V.UX.24 — reviews where `targetType='agent' AND targetId=agentId`,
   * newest first. The agent dashboard surfaces these so the agent can
   * respond inline.
   */
  listReviewsForAgent(input: {
    readonly agentId: string;
    readonly limit: number;
  }): Promise<readonly AgentReviewWithResponse[]>;
}

export const AGENT_REPOSITORY = Symbol('AgentRepository');
