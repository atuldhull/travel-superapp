/**
 * Phase 5 (J5) — travel-buddy matchmaking.
 *
 * "Who else has journeyed near where I'm going?" Owner-gated: only
 * the viewer's own trip is a valid source (you match buddies for
 * YOUR journey). The trip centre is read via GeoQueries (CLAUDE.md
 * #11 — never touch `Trip.center` directly); the repository
 * compares it against the COARSENED exposed location of candidate
 * PUBLIC publications (LAW 2 — precise geo never leaves the safety
 * fence).
 *
 * Honest scope: a $0 PLACE heuristic, not a date-matching or
 * compatibility engine — a published trip is always ENDED, so this
 * surfaces travellers who've been near your destination (their
 * dates ride along for display), not future companions. No
 * location → empty. Candidates are PUBLIC-only and block-filtered.
 *
 * Installed by prompt [J5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripBuddy,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export interface FindTripBuddiesQuery {
  readonly tripId: string;
  readonly viewerId: string;
  readonly limit?: number;
}

@Injectable()
export class FindTripBuddiesUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(query: FindTripBuddiesQuery): Promise<readonly TripBuddy[]> {
    // Owner-gate — buddies are matched for the caller's OWN trip.
    const trip = await this.trips.findByIdForUser(query.tripId, query.viewerId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: query.tripId }, 'TRIP_NOT_FOUND');
    }

    const center = await this.geo.findTripCenter(query.tripId);
    if (!center) return []; // no location resolved yet — nothing to match on

    return this.pubs.findTripBuddies({
      lat: center.lat,
      lng: center.lng,
      viewerId: query.viewerId,
      excludeTripId: query.tripId,
      limit: clampLimit(query.limit),
    });
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw)));
}
