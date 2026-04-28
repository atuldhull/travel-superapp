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

export interface AgentRepository {
  /**
   * Returns up to `limit` verified-only agent rows ordered by
   * `ratingAverage DESC, ratingCount DESC, verifiedAt DESC`.
   * Filters: `kycStatus = 'verified' AND verifiedAt IS NOT NULL`,
   * plus optional region match.
   */
  findVerifiedMatches(input: FindVerifiedMatchesInput): Promise<readonly AgentMatch[]>;
}

export const AGENT_REPOSITORY = Symbol('AgentRepository');
