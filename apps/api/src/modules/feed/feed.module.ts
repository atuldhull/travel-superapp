/**
 * Feed module — personal activity feed across the user's own
 * trips, reviews, memory book publishes, and scam reports.
 *
 * Routes:
 *   - `GET /feed/me` — merged chronological stream with
 *     cursor pagination (shipped [IV.18.17.1]).
 *
 * The Feed module is a thin read-side projection: every
 * adapter reads directly from `PrismaService` rather than
 * importing each producing module's repository ports. Same
 * pattern as the Account export aggregator
 * (`[IV.18.16.1]`) — keeps producer modules unaware of the
 * feed concept and the slice self-contained.
 *
 * `FEED_SOURCES` is a multi-provider symbol — every adapter
 * registers under the same token, and the use-case injects
 * the array (standard Nest pattern for "all implementations
 * of an interface"). Adding a new feed source (e.g. SOS
 * triggered, expense added) is a one-file diff: drop a new
 * adapter into `infrastructure/` and append it here.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Module } from '@nestjs/common';
import { GetMyFeedUseCase } from './application/get-my-feed.use-case';
import { FEED_SOURCES } from './application/ports/feed-source';
import { MemoryBookPublishedFeedSource } from './infrastructure/memory-book-published-feed-source';
import { ReviewFeedSource } from './infrastructure/review-feed-source';
import { ScamReportFeedSource } from './infrastructure/scam-report-feed-source';
import { TripFeedSource } from './infrastructure/trip-feed-source';
import { FeedController } from './interface/feed.controller';

@Module({
  controllers: [FeedController],
  providers: [
    // Concrete sources — exported as themselves too in case a
    // future use-case wants to query a single source directly.
    TripFeedSource,
    ReviewFeedSource,
    MemoryBookPublishedFeedSource,
    ScamReportFeedSource,
    {
      provide: FEED_SOURCES,
      useFactory: (
        trip: TripFeedSource,
        review: ReviewFeedSource,
        book: MemoryBookPublishedFeedSource,
        scam: ScamReportFeedSource,
      ) => [trip, review, book, scam],
      inject: [
        TripFeedSource,
        ReviewFeedSource,
        MemoryBookPublishedFeedSource,
        ScamReportFeedSource,
      ],
    },
    GetMyFeedUseCase,
  ],
})
export class FeedModule {}
