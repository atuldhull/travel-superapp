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
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SearchEateriesUseCase } from '../application/search-eateries.use-case';
import type { EateryListing } from '../domain/eatery-listing.entity';
import { SearchEateriesBodySchema, type SearchEateriesBody } from './dto/food.dto';

@Controller('eateries')
export class FoodController {
  constructor(private readonly searchEateries: SearchEateriesUseCase) {}

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
