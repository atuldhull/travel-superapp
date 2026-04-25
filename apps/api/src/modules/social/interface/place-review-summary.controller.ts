/**
 * Place detail-page composite read endpoint.
 *
 *   GET /api/v1/places/:id/review-summary
 *
 * `@Public()` — review + vote summaries are crowd signal, no
 * PII. Same precedent as `/reviews/summary` (`[IV.18.12.8]`)
 * and `/votes/summary` (`[IV.18.12.9]`).
 *
 * Returns a single bundle the place detail page can render
 * without fan-out:
 *   - reviews:  { count, average, histogram }
 *   - votes:    { up, meh, down, score }
 *   - recentReviews: top 5 most-recent reviews with full body
 *
 * Empty target → 200 with all-zero shape (NOT 404). Same
 * "empty ≠ missing" reasoning as the underlying summary
 * endpoints.
 *
 * Lives in PlacesModule so the URL is `/places/:id/review-summary`
 * — the more discoverable shape than mounting on Social.
 * SocialModule imported as a peer; one-way dep, no cycles.
 *
 * Installed by prompt [IV.18.12.11].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Public } from '../../../common/auth';
import {
  GetPlaceReviewSummaryUseCase,
  type PlaceReviewSummary,
} from '../application/get-place-review-summary.use-case';

interface PlaceReviewSummaryDto {
  readonly placeId: string;
  readonly reviews: {
    readonly count: number;
    readonly average: number;
    readonly histogram: Readonly<Record<string, number>>;
  };
  readonly votes: {
    readonly up: number;
    readonly meh: number;
    readonly down: number;
    readonly score: number;
  };
  readonly recentReviews: ReadonlyArray<{
    readonly id: string;
    readonly authorId: string;
    readonly rating: number;
    readonly body: string;
    readonly language: string;
    readonly verifiedBooking: boolean;
    readonly createdAt: string;
  }>;
}

function toDto(s: PlaceReviewSummary): PlaceReviewSummaryDto {
  return {
    placeId: s.placeId,
    reviews: {
      count: s.reviews.count,
      average: s.reviews.average,
      histogram: s.reviews.histogram as unknown as Readonly<Record<string, number>>,
    },
    votes: {
      up: s.votes.up,
      meh: s.votes.meh,
      down: s.votes.down,
      score: s.votes.score,
    },
    recentReviews: s.recentReviews.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      rating: r.rating,
      body: r.body,
      language: r.language,
      verifiedBooking: r.verifiedBooking,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

@Controller('places')
export class PlaceReviewSummaryController {
  constructor(private readonly summaryUc: GetPlaceReviewSummaryUseCase) {}

  @Get(':id/review-summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(@Param('id') id: string): Promise<PlaceReviewSummaryDto> {
    const result = await this.summaryUc.execute(id);
    return toDto(result);
  }
}
