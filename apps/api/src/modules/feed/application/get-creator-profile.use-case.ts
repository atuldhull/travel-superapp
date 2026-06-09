/**
 * POST.2B.3 — creator profile: an author's published trips the
 * viewer may see + follower / published counts. Same visibility +
 * block rules as the feed (enforced in the repo SQL).
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

export interface GetCreatorProfileQuery {
  readonly authorId: string;
  readonly viewerId: string;
  readonly limit?: number;
}

export interface CreatorProfile {
  readonly authorId: string;
  readonly followerCount: number;
  readonly publishedCount: number;
  /** Whether the viewer follows this author (seeds the Follow button). */
  readonly isFollowing: boolean;
  /** Whether either user has blocked the other (seeds the Block button). */
  readonly isBlocked: boolean;
  readonly trips: readonly TripPublication[];
}

@Injectable()
export class GetCreatorProfileUseCase {
  constructor(
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(q: GetCreatorProfileQuery): Promise<CreatorProfile> {
    const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const [trips, followerCount, publishedCount, isFollowing, isBlocked] = await Promise.all([
      this.pubs.listByAuthorVisibleTo(q.authorId, q.viewerId, limit),
      this.pubs.countFollowers(q.authorId),
      this.pubs.countPublishedByAuthor(q.authorId),
      this.pubs.isFollowing(q.viewerId, q.authorId),
      this.pubs.isBlockedBetween(q.viewerId, q.authorId),
    ]);
    return { authorId: q.authorId, followerCount, publishedCount, isFollowing, isBlocked, trips };
  }
}
