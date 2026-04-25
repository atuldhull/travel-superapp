/**
 * Port for one slice of the personal activity feed. The
 * use-case fans out across every registered source, merges by
 * `occurredAt` desc, and paginates over the merged stream.
 *
 * Adapters live in `feed/infrastructure/` and read directly
 * from the global `PrismaService` rather than going through
 * each producing module's repository ports. Feed is a thin
 * read-side projection across many tables — same reasoning
 * as the Account export aggregator (`[IV.18.16.1]`): the
 * producer modules don't need to know feed exists, and
 * keeping every adapter co-located makes the slice
 * self-contained.
 *
 * Pagination contract: `before` is exclusive. `recentForUser`
 * MUST return rows strictly older than that timestamp, sorted
 * desc. Returning at most `limit` rows is a soft cap — the
 * use-case applies the final cap after merging.
 *
 * Installed by prompt [IV.18.17.1].
 */
import type { FeedItem } from '../../domain/feed-item.entity';

export interface FeedSource {
  /**
   * Returns the caller's recent feed items from this source,
   * strictly older than `before` if provided, sorted desc by
   * `occurredAt`. Maximum `limit` rows.
   */
  recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]>;
}

/**
 * Multi-provider DI symbol — every feed-source adapter
 * registers under the same token, and the use-case injects
 * the array. Standard Nest pattern for "all implementations
 * of an interface".
 */
export const FEED_SOURCES = Symbol('FEED_SOURCES');
