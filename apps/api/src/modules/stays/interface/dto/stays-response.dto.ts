/**
 * Class-based response DTOs for the Stays HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.62].
 */
import { ApiProperty } from '@nestjs/swagger';

export class StaysCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class SearchStaysRequestDto {
  @ApiProperty({ type: StaysCoordinatesDto })
  declare center: StaysCoordinatesDto;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ format: 'date', description: 'ISO date YYYY-MM-DD.' })
  declare checkIn: string;

  @ApiProperty({ format: 'date', description: 'ISO date YYYY-MM-DD; must be after checkIn.' })
  declare checkOut: string;

  @ApiProperty({ required: false, description: 'Guest count (default 2).' })
  declare guests?: number;
}

export class StayListingDto {
  @ApiProperty({ description: 'Provider-side id, e.g. "booking:1234567".' })
  declare externalId: string;

  @ApiProperty({ description: 'Source provider key (booking, hotels, mock, etc.).' })
  declare provider: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty({ nullable: true, description: 'Star rating 1..5, or null if not rated.' })
  declare starRating: number | null;

  @ApiProperty({ type: [String] })
  declare amenities: string[];

  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty({ nullable: true, description: 'Per-night price USD, or null if no live quote.' })
  declare priceUsdPerNight: number | null;

  @ApiProperty({
    nullable: true,
    description: 'ISO 4217 code of the original quote currency (price is normalized to USD).',
  })
  declare currency: string | null;
}

export class SearchStaysResponseDto {
  @ApiProperty({ type: [StayListingDto] })
  declare stays: StayListingDto[];
}
