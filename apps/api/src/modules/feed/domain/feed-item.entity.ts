/**
 * Discriminated union for one row of the personal activity
 * feed. Each kind carries just enough payload for a feed card
 * (id + label + a couple of meaningful fields). Clients
 * needing the full entity follow the embedded id back to the
 * canonical detail endpoint.
 *
 * `occurredAt` is the cross-kind sort key. For trips it's the
 * latest of `createdAt` / `updatedAt` so editing an old trip
 * bumps it back to the top of the feed; for the others it's
 * the row's `createdAt` (or `publishedAt` for memory books —
 * "I just shared this album" is the meaningful event, not "I
 * created this draft last month").
 *
 * Installed by prompt [IV.18.17.1]. Extended by [IV.18.17.2]
 * with sos_triggered + expense_added + vote_cast kinds.
 */

export type FeedItemKind =
  | 'trip'
  | 'review'
  | 'memory_book_published'
  | 'scam_report'
  | 'sos_triggered'
  | 'expense_added'
  | 'vote_cast';

export interface FeedItemTripPayload {
  readonly tripId: string;
  readonly title: string;
  readonly status: string;
  readonly action: 'created' | 'updated';
}

export interface FeedItemReviewPayload {
  readonly reviewId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly rating: number;
}

export interface FeedItemMemoryBookPublishedPayload {
  readonly memoryBookId: string;
  readonly title: string;
}

export interface FeedItemScamReportPayload {
  readonly scamReportId: string;
  readonly category: string;
  readonly severity: string;
  readonly verified: boolean;
}

export interface FeedItemSosTriggeredPayload {
  readonly sosEventId: string;
  readonly trigger: string;
  readonly resolvedAt: string | null;
}

export interface FeedItemExpenseAddedPayload {
  readonly expenseId: string;
  readonly tripId: string;
  readonly amountUsd: string;
  readonly currency: string;
}

export interface FeedItemVoteCastPayload {
  readonly voteId: string;
  readonly tripId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly value: number;
}

interface FeedItemBase {
  readonly occurredAt: Date;
}

export type FeedItem =
  | (FeedItemBase & { readonly kind: 'trip'; readonly payload: FeedItemTripPayload })
  | (FeedItemBase & { readonly kind: 'review'; readonly payload: FeedItemReviewPayload })
  | (FeedItemBase & {
      readonly kind: 'memory_book_published';
      readonly payload: FeedItemMemoryBookPublishedPayload;
    })
  | (FeedItemBase & {
      readonly kind: 'scam_report';
      readonly payload: FeedItemScamReportPayload;
    })
  | (FeedItemBase & {
      readonly kind: 'sos_triggered';
      readonly payload: FeedItemSosTriggeredPayload;
    })
  | (FeedItemBase & {
      readonly kind: 'expense_added';
      readonly payload: FeedItemExpenseAddedPayload;
    })
  | (FeedItemBase & {
      readonly kind: 'vote_cast';
      readonly payload: FeedItemVoteCastPayload;
    });
