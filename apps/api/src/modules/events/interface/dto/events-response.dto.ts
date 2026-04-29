/**
 * Class-based response DTOs for the Events HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.64].
 */
import { ApiProperty } from '@nestjs/swagger';

export class EventsCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class SearchEventsRequestDto {
  @ApiProperty({ type: EventsCoordinatesDto })
  declare center: EventsCoordinatesDto;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ format: 'date-time', description: 'ISO-8601 inclusive lower bound.' })
  declare from: string;

  @ApiProperty({ format: 'date-time', description: 'ISO-8601 inclusive upper bound.' })
  declare to: string;

  @ApiProperty({ required: false, description: 'Filter by category slug.' })
  declare category?: string;

  @ApiProperty({
    required: false,
    description:
      'V.UX.16 — budget-backpacker filter. True = only free events (priceMin 0 or null).',
  })
  declare freeOnly?: boolean;
}

export class EventListingDto {
  @ApiProperty()
  declare externalId: string;

  @ApiProperty()
  declare provider: string;

  @ApiProperty()
  declare title: string;

  @ApiProperty({ nullable: true })
  declare description: string | null;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ nullable: true })
  declare venueName: string | null;

  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty({ format: 'date-time' })
  declare startsAt: string;

  @ApiProperty({ format: 'date-time' })
  declare endsAt: string;

  @ApiProperty({ nullable: true, description: 'ISO-4217 code; null for free events.' })
  declare currency: string | null;

  @ApiProperty({ nullable: true, description: 'Decimal string; null for free events.' })
  declare priceMin: string | null;

  @ApiProperty({ nullable: true })
  declare priceMax: string | null;

  @ApiProperty({ nullable: true })
  declare sourceUrl: string | null;
}

export class SearchEventsResponseDto {
  @ApiProperty({ type: [EventListingDto] })
  declare events: EventListingDto[];
}

export class FestivalsDuringResponseDto {
  @ApiProperty({
    type: [EventListingDto],
    description: 'Festival events overlapping the requested window, soonest-first.',
  })
  declare festivals: EventListingDto[];
}
