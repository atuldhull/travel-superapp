/**
 * Personal activity feed orchestrator. Fans out across every
 * registered `FeedSource`, merges by `occurredAt` desc, and
 * returns the top `limit` items + a `nextBefore` cursor for
 * the next page.
 *
 * Why fan-out + merge in app code instead of a single SQL
 * `UNION ALL`: the source rows live in different tables with
 * different shapes, owned by different modules. A union
 * query would either need raw SQL with shape-erasing JSON
 * columns OR cross-module Prisma access that violates the
 * clean-arch boundary. The fan-out is N tiny indexed reads
 * (one per source); the merge is in-memory over ~limit×N
 * rows. Cost is fine at v1 scale and stays cheap because
 * each source over-fetches just `limit` rows, not a full
 * table scan.
 *
 * Pagination: `before` is exclusive on `occurredAt`. Each
 * source returns ≤ `limit` rows older than `before`; the
 * merge step picks the top `limit` of the union. The
 * `nextBefore` cursor is the `occurredAt` of the last item
 * returned — the client passes it back to fetch the next
 * page. No `nextBefore` means "fewer rows than the limit
 * came back, you've reached the end".
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { FeedItem } from '../domain/feed-item.entity';
import { FEED_SOURCES, type FeedSource } from './ports/feed-source';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export interface GetMyFeedCommand {
  readonly userId: string;
  readonly before?: Date;
  readonly limit?: number;
}

export interface GetMyFeedResult {
  readonly items: readonly FeedItem[];
  readonly nextBefore: Date | null;
}

@Injectable()
export class GetMyFeedUseCase {
  constructor(@Inject(FEED_SOURCES) private readonly sources: readonly FeedSource[]) {}

  async execute(cmd: GetMyFeedCommand): Promise<GetMyFeedResult> {
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));

    // Fan out. Each source over-fetches up to `limit` rows so
    // the merged top-`limit` set is well-formed even if one
    // source dominates (e.g. user with 200 reviews + 0 trips
    // still gets a coherent first page).
    const perSource = await Promise.all(
      this.sources.map((s) => s.recentForUser(cmd.userId, cmd.before, limit)),
    );

    // Merge + sort desc + slice. `getTime()` is fine here —
    // dates from Prisma are real Date objects.
    const merged = perSource
      .flat()
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);

    // No `nextBefore` when we returned fewer than `limit` —
    // signals end-of-stream. When equal, the next page might
    // be empty, but we still hand back a cursor so clients
    // don't have to special-case "exactly limit".
    const nextBefore = merged.length === limit ? merged[merged.length - 1]!.occurredAt : null;

    return { items: merged, nextBefore };
  }
}
