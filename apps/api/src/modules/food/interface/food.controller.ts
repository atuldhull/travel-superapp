/**
 * Food / eateries HTTP surface. v1 is search-only. Dish-level
 * enrichment, reviews, booking each land in dedicated slices with
 * their own controllers.
 *
 *   POST /api/v1/eateries/search
 *     body: { center: {lat,lng}, radiusKm, cuisineTag?, maxPriceTier? }
 *     200 → { eateries: EateryListing[] }
 *     422 → INVALID_COORDINATES | INVALID_RADIUS | INVALID_PRICE_TIER
 *
 * Installed by prompt [IV.18.7.1].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SearchEateriesUseCase } from '../application/search-eateries.use-case';
import type { EateryListing } from '../domain/eatery-listing.entity';
import { SearchEateriesBodySchema, type SearchEateriesBody } from './dto/food.dto';
import { SearchEateriesRequestDto, SearchEateriesResponseDto } from './dto/food-response.dto';

@ApiTags('food')
@ApiBearerAuth()
@Controller('eateries')
export class FoodController {
  constructor(private readonly searchEateries: SearchEateriesUseCase) {}

  @ApiOperation({
    summary: 'Search eateries within a radius. Optional cuisine + price-tier filters.',
  })
  @ApiBody({ type: SearchEateriesRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Matching eateries, nearest-first.',
    type: SearchEateriesResponseDto,
  })
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body(new ZodValidationPipe(SearchEateriesBodySchema)) body: SearchEateriesBody,
  ): Promise<{ eateries: readonly EateryListing[] }> {
    const eateries = await this.searchEateries.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      radiusKm: body.radiusKm,
      ...(body.cuisineTag ? { cuisineTag: body.cuisineTag } : {}),
      ...(body.maxPriceTier !== undefined ? { maxPriceTier: body.maxPriceTier } : {}),
    });
    return { eateries };
  }
}
