/**
 * Class-based response DTOs for the trip surface. Documentation-only:
 * controllers still return plain object literals; these classes feed
 * `@nestjs/swagger` so `openapi.yaml` carries `components/schemas/*`
 * entries. Orval then turns those into typed `data:` fields on the
 * generated React Query hooks.
 *
 * Scope (v1): list, get, create. The overview endpoint emits seven
 * discriminated-union sections (`Section<T>` from
 * `get-trip-overview.use-case.ts`) which need a richer schema treatment
 * — landing in a follow-up slice.
 *
 * Installed by prompt [IV.18.19.22].
 */
import { ApiProperty } from '@nestjs/swagger';

export class TripDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid', description: "Owner's user id." })
  declare userId: string;

  @ApiProperty({ description: 'Owner-chosen title (1..120 chars).' })
  declare title: string;

  @ApiProperty({
    description: 'Lifecycle status — currently always "draft" until itinerary AI lands.',
  })
  declare status: string;

  @ApiProperty({ description: 'Trip planning radius in km (1..500).', minimum: 1, maximum: 500 })
  declare radiusKm: number;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601; null until the owner picks a date range.',
  })
  declare startsOn: string | null;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601; null until the owner picks a date range. >= startsOn when both set.',
  })
  declare endsOn: string | null;

  @ApiProperty({ description: 'Bumped on every accepted update — concurrency control.' })
  declare version: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ListTripsResponseDto {
  @ApiProperty({
    type: [TripDto],
    description: 'Caller-owned trips, most-recent-first. Capped via ?limit (1..100, default 20).',
  })
  declare trips: TripDto[];
}

/**
 * Body class for PATCH /trips/:id. Documentation-only — runtime
 * validation stays on `UpdateTripBodySchema` in `trip.dto.ts`. All
 * fields optional; only provided fields change. Date fields accept
 * `null` to clear the value.
 */
export class UpdateTripRequestDto {
  @ApiProperty({ required: false, description: '1..120 chars.' })
  declare title?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  declare radiusKm?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601 or null to clear.',
  })
  declare startsOn?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601 or null to clear. >= startsOn when both set.',
  })
  declare endsOn?: string | null;
}

/**
 * Body class for POST /trips. Documentation-only — runtime validation
 * stays on `CreateTripBodySchema` in `trip.dto.ts`.
 */
export class CreateTripRequestDto {
  @ApiProperty({ description: '1..120 chars.' })
  declare title: string;

  @ApiProperty({
    description: 'GeoJSON-style { lng, lat } center — same shape the api persists via PostGIS.',
    type: 'object',
    additionalProperties: false,
    properties: {
      lng: { type: 'number', minimum: -180, maximum: 180 },
      lat: { type: 'number', minimum: -90, maximum: 90 },
    },
    required: ['lng', 'lat'],
  })
  declare center: { lng: number; lat: number };

  @ApiProperty({ minimum: 1, maximum: 500 })
  declare radiusKm: number;

  @ApiProperty({ required: false, format: 'date-time' })
  declare startsOn?: string;

  @ApiProperty({ required: false, format: 'date-time' })
  declare endsOn?: string;
}
