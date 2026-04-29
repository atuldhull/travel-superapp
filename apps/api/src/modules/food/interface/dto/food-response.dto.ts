/**
 * Class-based response DTOs for the Food / eateries HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.60].
 */
import { ApiProperty } from '@nestjs/swagger';

export class FoodCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class SearchEateriesRequestDto {
  @ApiProperty({ type: FoodCoordinatesDto })
  declare center: FoodCoordinatesDto;

  @ApiProperty({ description: 'Search radius in km.' })
  declare radiusKm: number;

  @ApiProperty({ required: false, description: 'Filter by cuisine tag (e.g. "vegan", "pizza").' })
  declare cuisineTag?: string;

  @ApiProperty({
    required: false,
    description: 'Cap on price tier 1–5 ($ through $$$$$). Excludes pricier results.',
  })
  declare maxPriceTier?: number;
}

export class EateryListingDto {
  @ApiProperty({
    description: 'Provider-side id (Google place_id, FSQ fsq_id, OSM way/node id, etc.).',
  })
  declare externalId: string;

  @ApiProperty({ enum: ['google', 'fsq', 'osm', 'mock'], description: 'Source provider key.' })
  declare provider: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty({ type: [String] })
  declare cuisineTags: string[];

  @ApiProperty({ description: 'Price tier 1–5 ($ through $$$$$).' })
  declare priceTier: number;

  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty({ description: 'Distance from search center, meters.' })
  declare distanceMeters: number;
}

export class SearchEateriesResponseDto {
  @ApiProperty({ type: [EateryListingDto], description: 'Matching eateries, nearest-first.' })
  declare eateries: EateryListingDto[];
}

export class DishDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare eateryId: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty({ nullable: true, description: '2-decimal string; null when not reported.' })
  declare priceUsd: string | null;

  @ApiProperty({ nullable: true, description: 'Public URL to the dish photo (S3 or external).' })
  declare photoUrl: string | null;

  @ApiProperty({ nullable: true, description: 'Foodie caption, ≤ 280 chars.' })
  declare caption: string | null;

  @ApiProperty({ nullable: true, format: 'cuid' })
  declare reportedBy: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ListDishesResponseDto {
  @ApiProperty({ type: [DishDto] })
  declare dishes: DishDto[];
}

export class AddDishReportRequestDto {
  @ApiProperty({ description: 'Dish name 1..120 chars.' })
  declare name: string;

  @ApiProperty({ required: false, description: 'Reported price in USD (0, 9999.99].' })
  declare priceUsd?: number;

  @ApiProperty({ required: false, description: 'Public photo URL ≤ 1024 chars.' })
  declare photoUrl?: string;

  @ApiProperty({ required: false, description: 'Foodie caption ≤ 280 chars.' })
  declare caption?: string;
}

export class BuildFoodCrawlRequestDto {
  @ApiProperty({
    type: [String],
    description: '2..5 eatery ids. The first id anchors the crawl; rest are greedy-NN ordered.',
    minItems: 2,
    maxItems: 5,
  })
  declare eateryIds: string[];
}

export class FoodCrawlStopDto {
  @ApiProperty({ format: 'cuid' })
  declare eateryId: string;

  @ApiProperty({ description: '1-indexed crawl position.' })
  declare position: number;

  @ApiProperty({ description: 'Walking metres from the previous stop (0 for the anchor).' })
  declare distanceMetersFromPrev: number;

  @ApiProperty({ description: 'Walking seconds from the previous stop (0 for the anchor).' })
  declare walkingSecondsFromPrev: number;
}

export class BuildFoodCrawlResponseDto {
  @ApiProperty({ type: [FoodCrawlStopDto] })
  declare stops: FoodCrawlStopDto[];

  @ApiProperty()
  declare totalDistanceMeters: number;

  @ApiProperty()
  declare totalWalkingSeconds: number;
}
