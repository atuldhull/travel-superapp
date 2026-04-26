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
