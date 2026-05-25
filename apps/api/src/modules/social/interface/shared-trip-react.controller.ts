/**
 * V.UX.10 anonymous shared-trip reactions. Two routes — both
 * `@Public()`, both bound to the public share-code (the recipient
 * never needs an account).
 *
 *   POST /trips/shared/:code/heart  → bump + return count
 *   GET  /trips/shared/:code/hearts → read count
 *
 * The POST is rate-limited per-IP at 1/min via `@Throttle({ default:
 * { limit: 1, ttl: 60_000 } })` — high enough that a real fan can
 * react comfortably; low enough that a script can't farm hearts.
 *
 * Installed by prompt [V.UX.10].
 */
import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/auth';
import { HeartSharedTripUseCase } from '../application/heart-shared-trip.use-case';
import {
  TRIP_HEART_COUNTER_PORT,
  type TripHeartCounterPort,
} from '../application/ports/trip-heart-counter.port';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from '../../trip';
import { Inject } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import {
  HeartSharedTripResponseDto,
  SharedTripHeartCountResponseDto,
} from './dto/social-response.dto';

/**
 * Test mode bumps the heart-route limit from 1/min to a flat 10_000
 * so unrelated tests in the same worker don't trip the throttle —
 * mirrors the inflate logic in `RateLimitModule` for the named
 * buckets. Production keeps the strict 1/min cap.
 */
const HEART_LIMIT_PER_MIN = process.env['NODE_ENV'] === 'test' ? 10_000 : 1;

@ApiTags('social')
@Controller('trips/shared')
export class SharedTripReactController {
  constructor(
    private readonly heart: HeartSharedTripUseCase,
    @Inject(TRIP_HEART_COUNTER_PORT) private readonly counter: TripHeartCounterPort,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @ApiOperation({
    summary:
      "❤️ a publicly-shared trip. No auth. Per-IP rate-limited at 1/min so anonymous fans can react but scripts can't farm hearts.",
  })
  @ApiResponse({
    status: 200,
    description: 'Updated heart count for the trip.',
    type: HeartSharedTripResponseDto,
  })
  @ApiResponse({ status: 404, description: 'SHARE_NOT_FOUND or SHARE_EXPIRED.' })
  @ApiResponse({ status: 429, description: 'Too many requests — wait 60s.' })
  @Public()
  @Throttle({ default: { limit: HEART_LIMIT_PER_MIN, ttl: 60_000 } })
  @Post(':code/heart')
  @HttpCode(HttpStatus.OK)
  async heartTrip(@Param('code') code: string): Promise<{ tripId: string; hearts: number }> {
    return this.heart.execute(code);
  }

  @ApiOperation({ summary: 'Current ❤️ count for a shared trip. Public, no auth.' })
  @ApiResponse({
    status: 200,
    description: 'Heart count snapshot.',
    type: SharedTripHeartCountResponseDto,
  })
  @ApiResponse({ status: 404, description: 'SHARE_NOT_FOUND or SHARE_EXPIRED.' })
  @Public()
  @Get(':code/hearts')
  @HttpCode(HttpStatus.OK)
  async getHearts(@Param('code') code: string): Promise<{ tripId: string; hearts: number }> {
    const share = await this.shares.findByCode(code);
    if (!share || !share.publicRead) {
      throw new NotFoundError('Share not found', { shareCode: code }, 'SHARE_NOT_FOUND');
    }
    if (share.expiresAt && share.expiresAt.getTime() <= this.clock.nowMs()) {
      throw new NotFoundError(
        'Share has expired',
        { shareCode: code, expiredAt: share.expiresAt.toISOString() },
        'SHARE_EXPIRED',
      );
    }
    const hearts = await this.counter.get(share.tripId);
    return { tripId: share.tripId, hearts };
  }
}
