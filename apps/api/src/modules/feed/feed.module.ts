/**
 * Feed module — personal activity feed across the user's own
 * trips, reviews, memory book publishes, scam reports, SOS
 * events, expenses paid, and votes cast.
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
 * of an interface"). Adding a new feed source is a one-file
 * diff: drop a new adapter into `infrastructure/` and append
 * it here.
 *
 * Installed by prompt [IV.18.17.1]. Extended in [IV.18.17.2]
 * with `sos_triggered` + `expense_added` + `vote_cast`
 * sources.
 */
import { Module } from '@nestjs/common';
import { TripModule } from '../trip/trip.module';
import { GetMyFeedUseCase } from './application/get-my-feed.use-case';
import { FEED_SOURCES } from './application/ports/feed-source';
// POST.2B.2 — trip publication
import { TRIP_PUBLICATION_REPOSITORY } from './application/ports/trip-publication.repository';
import { PrismaTripPublicationRepository } from './infrastructure/prisma-trip-publication.repository';
import { PublishTripUseCase } from './application/publish-trip.use-case';
import { UnpublishTripUseCase } from './application/unpublish-trip.use-case';
import { ExpenseAddedFeedSource } from './infrastructure/expense-added-feed-source';
import { MemoryBookPublishedFeedSource } from './infrastructure/memory-book-published-feed-source';
import { ReviewFeedSource } from './infrastructure/review-feed-source';
import { ScamReportFeedSource } from './infrastructure/scam-report-feed-source';
import { SosTriggeredFeedSource } from './infrastructure/sos-triggered-feed-source';
import { TripFeedSource } from './infrastructure/trip-feed-source';
import { VoteCastFeedSource } from './infrastructure/vote-cast-feed-source';
import { FeedController } from './interface/feed.controller';

@Module({
  imports: [TripModule],
  controllers: [FeedController],
  providers: [
    { provide: TRIP_PUBLICATION_REPOSITORY, useClass: PrismaTripPublicationRepository },
    PublishTripUseCase,
    UnpublishTripUseCase,
    // Concrete sources — exported as themselves too in case a
    // future use-case wants to query a single source directly.
    TripFeedSource,
    ReviewFeedSource,
    MemoryBookPublishedFeedSource,
    ScamReportFeedSource,
    SosTriggeredFeedSource,
    ExpenseAddedFeedSource,
    VoteCastFeedSource,
    {
      provide: FEED_SOURCES,
      useFactory: (
        trip: TripFeedSource,
        review: ReviewFeedSource,
        book: MemoryBookPublishedFeedSource,
        scam: ScamReportFeedSource,
        sos: SosTriggeredFeedSource,
        expense: ExpenseAddedFeedSource,
        vote: VoteCastFeedSource,
      ) => [trip, review, book, scam, sos, expense, vote],
      inject: [
        TripFeedSource,
        ReviewFeedSource,
        MemoryBookPublishedFeedSource,
        ScamReportFeedSource,
        SosTriggeredFeedSource,
        ExpenseAddedFeedSource,
        VoteCastFeedSource,
      ],
    },
    GetMyFeedUseCase,
  ],
})
export class FeedModule {}
