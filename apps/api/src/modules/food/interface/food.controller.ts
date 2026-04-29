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
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public, type AuthenticatedUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AddDishReportUseCase } from '../application/add-dish-report.use-case';
import {
  ListDishesForEateryUseCase,
  type DishView,
} from '../application/list-dishes-for-eatery.use-case';
import { SearchEateriesUseCase } from '../application/search-eateries.use-case';
import type { EateryListing } from '../domain/eatery-listing.entity';
import {
  AddDishReportBodySchema,
  SearchEateriesBodySchema,
  type AddDishReportBody,
  type SearchEateriesBody,
} from './dto/food.dto';
import {
  AddDishReportRequestDto,
  DishDto,
  ListDishesResponseDto,
  SearchEateriesRequestDto,
  SearchEateriesResponseDto,
} from './dto/food-response.dto';

function dishToDto(d: DishView): DishDto {
  return {
    id: d.id,
    eateryId: d.eateryId,
    name: d.name,
    priceUsd: d.priceUsd,
    photoUrl: d.photoUrl,
    caption: d.caption,
    reportedBy: d.reportedBy,
    createdAt: d.createdAt.toISOString(),
  } satisfies DishDto;
}

@ApiTags('food')
@ApiBearerAuth()
@Controller('eateries')
export class FoodController {
  constructor(
    private readonly searchEateries: SearchEateriesUseCase,
    private readonly listDishes: ListDishesForEateryUseCase,
    private readonly addDishReport: AddDishReportUseCase,
  ) {}

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

  /**
   * V.UX.20 — list every Dish reported on an eatery, newest first.
   * Public so the eatery detail page is shareable without auth.
   */
  @Public()
  @ApiOperation({ summary: 'List dishes reported on an eatery (newest first).' })
  @ApiParam({ name: 'eateryId', format: 'cuid' })
  @ApiResponse({ status: 200, description: 'Dish list.', type: ListDishesResponseDto })
  @Get(':eateryId/dishes')
  @HttpCode(HttpStatus.OK)
  async dishes(@Param('eateryId') eateryId: string): Promise<{ dishes: DishDto[] }> {
    const dishes = await this.listDishes.execute(eateryId);
    return { dishes: dishes.map(dishToDto) };
  }

  /**
   * V.UX.20 — record a foodie's dish report on an eatery. Auth-gated.
   * The reporter's user-id is stamped server-side (never trusted from
   * the body).
   */
  @ApiOperation({ summary: 'Report a dish on an eatery (auth required).' })
  @ApiParam({ name: 'eateryId', format: 'cuid' })
  @ApiBody({ type: AddDishReportRequestDto })
  @ApiResponse({ status: 201, description: 'The newly created dish report.', type: DishDto })
  @Post(':eateryId/dishes')
  @HttpCode(HttpStatus.CREATED)
  async createDish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eateryId') eateryId: string,
    @Body(new ZodValidationPipe(AddDishReportBodySchema)) body: AddDishReportBody,
  ): Promise<DishDto> {
    const cmd: {
      eateryId: string;
      reporterId: string;
      name: string;
      priceUsd?: number;
      photoUrl?: string;
      caption?: string;
    } = {
      eateryId,
      reporterId: user.sub,
      name: body.name,
    };
    if (body.priceUsd !== undefined) cmd.priceUsd = body.priceUsd;
    if (body.photoUrl !== undefined) cmd.photoUrl = body.photoUrl;
    if (body.caption !== undefined) cmd.caption = body.caption;
    const created = await this.addDishReport.execute(cmd);
    return dishToDto(created);
  }
}
