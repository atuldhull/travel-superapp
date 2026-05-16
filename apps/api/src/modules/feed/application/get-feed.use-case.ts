/**
 * POST.2B.3 — the pull feed (boring-correct: ONE indexed query,
 * reverse-chron, cursor-paginated; NO ranking, NO precompute).
 *
 * All visibility + block filtering lives in the repo's single SQL
 * query (proven against the real DB by feed-visibility.e2e-spec in
 * the Phase B gate). This use-case only handles paging.
 *
 * Installed by prompt [POST.2B.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripPublication } from '../domain/trip-publication.entity';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface GetFeedQuery {
  readonly viewerId: string;
  readonly limit?: number;
  readonly before?: Date;
}

export interface GetFeedResult {
  readonly items: readonly TripPublication[];
  readonly nextBefore: Date | null;
}

@Injectable()
export class GetFeedUseCase {
  constructor(
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(q: GetFeedQuery): Promise<GetFeedResult> {
    const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const items = await this.pubs.listFeed(q.viewerId, limit, q.before ?? null);
    // Full page → there may be more; cursor = the last (oldest) item.
    const nextBefore =
      items.length === limit ? (items[items.length - 1]?.publishedAt ?? null) : null;
    return { items, nextBefore };
  }
}
