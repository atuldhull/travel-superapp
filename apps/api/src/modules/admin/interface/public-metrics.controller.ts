/**
 * V.UX.40 — public landing-page metrics endpoint.
 *
 *   GET /api/v1/metrics-public → { tripsThisMonth, memoryBooksThisMonth,
 *                                  activeUsersThisWeek, computedAt }
 *
 * `@Public()` because the landing page renders this strip for every
 * visitor, including anonymous ones. Counts are pre-fuzzed at the
 * use-case layer (rounded to nearest 10 below 1000) so exact churn
 * can't be polled out.
 *
 * In-memory 5-minute cache layer keeps load off Postgres if the
 * landing page goes viral. Cache key is global (the response has no
 * per-user shape).
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import {
  GetPublicMetricsUseCase,
  type PublicMetrics,
} from '../application/get-public-metrics.use-case';

class PublicMetricsResponseDto {
  @ApiProperty({ description: 'Trips created in the last 30 days (fuzzed under 1000).' })
  declare tripsThisMonth: number;

  @ApiProperty({ description: 'Memory books created in the last 30 days (fuzzed under 1000).' })
  declare memoryBooksThisMonth: number;

  @ApiProperty({ description: 'Distinct users with lastSeenAt in the last 7 days (fuzzed).' })
  declare activeUsersThisWeek: number;

  @ApiProperty({ format: 'date-time' })
  declare computedAt: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  readonly expiresAt: number;
  readonly value: PublicMetrics;
}

@ApiTags('public')
@Controller('metrics-public')
export class PublicMetricsController {
  private cache: CacheEntry | null = null;

  constructor(private readonly getUc: GetPublicMetricsUseCase) {}

  @ApiOperation({
    summary: 'V.UX.40 — anonymized landing-page counts. Public, 5-min cached, fuzzed under 1000.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sanitized aggregate metrics.',
    type: PublicMetricsResponseDto,
  })
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async get(): Promise<PublicMetrics> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }
    const value = await this.getUc.execute();
    this.cache = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  }
}
