/**
 * Phase 5 (J3) — "Discover travellers": people the viewer might
 * want to follow.
 *
 * $0, no ML: surfaces authors of PUBLIC published trips the viewer
 * doesn't already follow, ranked by how prolific they are. The
 * repository owns the exclusion rules (self / already-followed /
 * blocked / soft-deleted) in one query; this use-case is a thin
 * clamp-and-delegate seam so the controller stays declarative.
 *
 * Installed by prompt [J3].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type SuggestedTraveller,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export interface SuggestedTravellersQuery {
  readonly viewerId: string;
  readonly limit?: number;
}

@Injectable()
export class SuggestedTravellersUseCase {
  constructor(
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(query: SuggestedTravellersQuery): Promise<readonly SuggestedTraveller[]> {
    return this.pubs.listSuggestedTravellers(query.viewerId, clampLimit(query.limit));
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw)));
}
