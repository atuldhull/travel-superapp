/**
 * POST.2C.3 — the "trips like this" discovery rail.
 *
 * pgvector-nearest PUBLISHED trips to an already-published source
 * trip. Visibility + block filtering is enforced in the repository's
 * shared security predicate (LAW 2, NON-NEGOTIABLE: PRIVATE + blocked
 * never surface). No embeddings on the source trip → `[]` (the web
 * rail renders an EmptyState — no crash, LAW 1).
 *
 * Installed by prompt [POST.2C.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
  type SimilarTrip,
} from './ports/trip-publication.repository';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;

export interface SimilarTripsQuery {
  readonly sourceTripId: string;
  readonly viewerId: string;
  readonly limit?: number;
}

@Injectable()
export class SimilarTripsUseCase {
  constructor(
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(q: SimilarTripsQuery): Promise<readonly SimilarTrip[]> {
    const limit = clampLimit(q.limit ?? DEFAULT_LIMIT);
    return this.pubs.findSimilarToPublication(q.sourceTripId, q.viewerId, limit);
  }
}

export function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(Math.floor(n), MAX_LIMIT);
}
