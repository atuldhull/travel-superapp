/**
 * V.UX.17 — concierge agent-match for a trip. Premium-tier
 * (or admin) callers only; the controller enforces the role gate
 * via `@Roles('premium', 'admin')`.
 *
 * Inputs:
 *   - tripId: must be owned by the caller (404 otherwise).
 *   - region: optional. When set, only agents whose `regions` array
 *     contains the value (case-sensitive exact, since agent rows
 *     should be seeded with canonical region tokens) are matched.
 *     When unset, returns the top-rated verified agents globally —
 *     a useful fallback for the first-time concierge user before
 *     they've identified a region.
 *
 * Always returns up to 3 matches, ordered by ratingAverage,
 * ratingCount, verifiedAt — see `findVerifiedMatches` for the
 * exact ordering. Empty array is a valid response (no agents seeded
 * for this region yet).
 *
 * Installed by prompt [V.UX.17].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip';
import type { AgentMatch } from '../domain/agent-match.entity';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';

const MATCH_LIMIT = 3;

export interface MatchAgentForTripCommand {
  readonly tripId: string;
  readonly ownerId: string;
  readonly region?: string;
}

@Injectable()
export class MatchAgentForTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(AGENT_REPOSITORY) private readonly agents: AgentRepository,
  ) {}

  async execute(cmd: MatchAgentForTripCommand): Promise<readonly AgentMatch[]> {
    // Owner gate: a premium caller can only match agents for trips
    // they own. A non-owner gets 404 — same IDOR posture as the rest
    // of the trip-scoped surfaces.
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.ownerId);
    if (!trip) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    return this.agents.findVerifiedMatches({
      ...(cmd.region && cmd.region.trim().length > 0 ? { region: cmd.region.trim() } : {}),
      limit: MATCH_LIMIT,
    });
  }
}
