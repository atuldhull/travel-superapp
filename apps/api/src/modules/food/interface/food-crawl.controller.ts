/**
 * V.UX.20 — food-crawl HTTP surface for the foodie persona.
 *
 *   POST /api/v1/trips/:tripId/food-crawl
 *     body: { eateryIds: string[2..5] }
 *     201 → { stops: [...], totalDistanceMeters, totalWalkingSeconds }
 *     422 → INVALID_FOOD_CRAWL_SIZE | VALIDATION_FAILED
 *     404 → TRIP_NOT_FOUND | EATERY_NOT_FOUND
 *
 * Lives in the food module (not trip) because the crawl logic is
 * dish-centric and depends on the Eatery PostGIS layer; the trip
 * gate is a cross-module read of `TRIP_REPOSITORY`. Defensive route
 * ordering — the literal `food-crawl` segment is mounted on a
 * standalone controller so it never collides with the trip
 * module's `:dayId` paths.
 *
 * Installed by prompt [V.UX.20].
 */
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { BuildFoodCrawlUseCase } from '../application/build-food-crawl.use-case';
import { BuildFoodCrawlBodySchema, type BuildFoodCrawlBody } from './dto/food.dto';
import { BuildFoodCrawlRequestDto, BuildFoodCrawlResponseDto } from './dto/food-response.dto';

@ApiTags('food')
@ApiBearerAuth()
@Controller('trips')
export class FoodCrawlController {
  constructor(private readonly buildCrawl: BuildFoodCrawlUseCase) {}

  @ApiOperation({
    summary:
      'Build a walking-optimised food crawl across 2..5 eateries. Owner-gated against the trip.',
  })
  @ApiParam({ name: 'tripId', format: 'cuid' })
  @ApiBody({ type: BuildFoodCrawlRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Walking-ordered crawl + per-leg + total distances/durations.',
    type: BuildFoodCrawlResponseDto,
  })
  @Post(':tripId/food-crawl')
  @HttpCode(HttpStatus.CREATED)
  async build(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body(new ZodValidationPipe(BuildFoodCrawlBodySchema)) body: BuildFoodCrawlBody,
  ): Promise<BuildFoodCrawlResponseDto> {
    const plan = await this.buildCrawl.execute({
      tripId,
      ownerId: user.sub,
      eateryIds: body.eateryIds,
    });
    return {
      stops: plan.stops.map((s) => ({
        eateryId: s.eateryId,
        position: s.position,
        distanceMetersFromPrev: s.distanceMetersFromPrev,
        walkingSecondsFromPrev: s.walkingSecondsFromPrev,
      })),
      totalDistanceMeters: plan.totalDistanceMeters,
      totalWalkingSeconds: plan.totalWalkingSeconds,
    };
  }
}
