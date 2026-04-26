/**
 * Class-based response DTOs for the Places HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.63].
 */
import { ApiProperty } from '@nestjs/swagger';

export class PlacesCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class SearchPlacesRequestDto {
  @ApiProperty({ type: PlacesCoordinatesDto })
  declare center: PlacesCoordinatesDto;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ required: false, description: 'Filter by category slug.' })
  declare category?: string;

  @ApiProperty({ required: false, description: 'Cap on result count.' })
  declare limit?: number;
}

export class FederatedSearchPlacesRequestDto {
  @ApiProperty({ type: PlacesCoordinatesDto })
  declare center: PlacesCoordinatesDto;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ required: false })
  declare category?: string;

  @ApiProperty({
    required: false,
    description:
      'When true, results are written through to the canonical Place catalog (idempotent dedup) and each row carries the canonical placeId.',
  })
  declare ingest?: boolean;
}

export class PlaceDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Stable provider key (e.g. "google:place_id").' })
  declare sourceKey: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ nullable: true })
  declare address: string | null;

  @ApiProperty({ nullable: true, description: 'ISO 3166-1 alpha-2.' })
  declare countryCode: string | null;

  @ApiProperty({ description: 'Curated local relaxation score 0..100.' })
  declare relaxationScore: number;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class SearchPlacesResponseDto {
  @ApiProperty({ type: [PlaceDto] })
  declare places: PlaceDto[];
}

export class FederatedPlaceResultDto {
  @ApiProperty({ description: 'Provider-side stable id.' })
  declare externalId: string;

  @ApiProperty({ description: 'Source provider key.' })
  declare provider: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ nullable: true })
  declare address: string | null;

  @ApiProperty({ nullable: true, description: 'ISO 3166-1 alpha-2.' })
  declare countryCode: string | null;

  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty({
    required: false,
    format: 'cuid',
    description: 'Canonical Place id (only set when ingest=true on the request).',
  })
  declare placeId?: string;

  @ApiProperty({
    required: false,
    description:
      'True iff this call inserted the row; false if already cached. Only set when ingest=true.',
  })
  declare created?: boolean;
}

export class FederatedSearchPlacesResponseDto {
  @ApiProperty({ type: [FederatedPlaceResultDto] })
  declare results: FederatedPlaceResultDto[];
}
