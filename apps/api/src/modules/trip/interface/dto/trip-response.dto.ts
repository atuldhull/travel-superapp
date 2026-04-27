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

export class ItineraryItemDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Stable position within the day (used for ordering).' })
  declare position: number;

  @ApiProperty({ nullable: true, format: 'cuid' })
  declare placeId: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare startTime: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare endTime: string | null;

  @ApiProperty({ nullable: true })
  declare notes: string | null;
}

export class ItineraryDayDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty({ description: 'Zero-based index from the trip start date.' })
  declare dayIndex: number;

  @ApiProperty({ format: 'date-time' })
  declare date: string;

  @ApiProperty({ nullable: true })
  declare summary: string | null;

  @ApiProperty({ type: [ItineraryItemDto] })
  declare items: ItineraryItemDto[];
}

export class ItineraryListResponseDto {
  @ApiProperty({
    type: [ItineraryDayDto],
    description: 'Itinerary days, ordered by dayIndex ascending.',
  })
  declare days: ItineraryDayDto[];
}

/**
 * Body item for `PATCH /trips/:tripId/itinerary/:dayId`. Position is
 * 1-based int; placeId is optional (null = freeform note); notes are
 * optional with a 500-char cap. Documentation-only — runtime
 * validation stays on `UpdateDayItemsBodySchema` in `trip.dto.ts`.
 */
export class UpdateDayItemDto {
  @ApiProperty({ description: '1-based position within the day.', minimum: 1 })
  declare position: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Place id (cuid). Null/omit for a freeform note item.',
  })
  declare placeId?: string | null;

  @ApiProperty({ required: false, nullable: true, maxLength: 500 })
  declare notes?: string | null;
}

export class UpdateDayItemsRequestDto {
  @ApiProperty({
    type: [UpdateDayItemDto],
    description: "Replaces the day's entire items array. Empty `[]` clears the day.",
  })
  declare items: UpdateDayItemDto[];
}

export class UpdateDayItemsResponseDto {
  @ApiProperty({ type: ItineraryDayDto })
  declare day: ItineraryDayDto;
}

/**
 * Body for `POST /trips/:id/share`. Documentation-only — runtime
 * validation stays on `CreateTripShareBodySchema` in `trip.dto.ts`.
 */
export class CreateTripShareRequestDto {
  @ApiProperty({
    required: false,
    format: 'date-time',
    description: 'Optional expiry. Omit for a non-expiring share code.',
  })
  declare expiresAt?: string;
}

export class GeneratePlanWithAiResponseDto {
  @ApiProperty({ description: 'Free-form prose plan from the AI provider.' })
  declare plan: string;

  @ApiProperty({
    description:
      'Model identifier (e.g. "claude-sonnet-4-6" or "stub-trip-planner" when CLAUDE_API_KEY is unset).',
  })
  declare model: string;
}

export class SamplePlanCenterDto {
  @ApiProperty({ description: 'Latitude in decimal degrees, -90..90.' })
  declare lat: number;

  @ApiProperty({ description: 'Longitude in decimal degrees, -180..180.' })
  declare lng: number;
}

export class GenerateSamplePlanRequestDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 120,
    description: 'Sample destination title (e.g. "Goa", "Tokyo").',
  })
  declare title: string;

  @ApiProperty({ type: SamplePlanCenterDto })
  declare center: SamplePlanCenterDto;

  @ApiProperty({ minimum: 1, maximum: 200, description: 'Search radius in km.' })
  declare radiusKm: number;
}

export class GenerateSamplePlanResponseDto {
  @ApiProperty({ description: 'Free-form prose plan from the AI provider.' })
  declare plan: string;

  @ApiProperty({
    description:
      'Model identifier (e.g. "claude-sonnet-4-6" or "stub-trip-planner" when CLAUDE_API_KEY is unset).',
  })
  declare model: string;
}

/**
 * Body for `POST /trips/:id/place-suggestions`. Documentation-only —
 * runtime validation stays on `SuggestPlacesForTripBodySchema`.
 *
 * Installed by prompt [V.UX.4].
 */
export class SuggestPlacesForTripRequestDto {
  @ApiProperty({
    required: false,
    description: 'Optional category filter ("museum", "cafe", "park", ...).',
  })
  declare category?: string;
}

export class SuggestedPlaceDto {
  @ApiProperty({ format: 'cuid', description: 'Persisted Place id, ready for itinerary items.' })
  declare placeId: string;

  @ApiProperty({ description: 'Display name from the federated provider.' })
  declare name: string;

  @ApiProperty({ description: 'Place category ("museum", "cafe", ...).' })
  declare category: string;

  @ApiProperty({ description: 'Straight-line distance from the trip center, metres.' })
  declare distanceMeters: number;
}

export class SuggestPlacesForTripResponseDto {
  @ApiProperty({
    type: [SuggestedPlaceDto],
    description: 'Up to 6 ranked suggestions, nearest first.',
  })
  declare suggestions: SuggestedPlaceDto[];
}

/**
 * Body for `POST /trips/:tripId/days/:dayId/optimize`. Empty for v1
 * — the use-case only needs the path params. Documentation-only;
 * runtime validation lives in the controller (no body).
 *
 * Installed by prompt [V.UX.6].
 */
export class OptimizeDayRouteResponseDto {
  @ApiProperty({
    type: ItineraryDayDto,
    description: 'Reordered itinerary day with refreshed items.',
  })
  declare day: ItineraryDayDto;

  @ApiProperty({
    description:
      'Total travel seconds across all consecutive routable stops, in the original order.',
  })
  declare beforeSeconds: number;

  @ApiProperty({
    description: 'Total travel seconds in the optimized order. Compare to `beforeSeconds`.',
  })
  declare afterSeconds: number;

  @ApiProperty({
    description:
      'Items dropped from the route (placeId no longer in the catalog). Trailing in the new order; never lost.',
  })
  declare skippedCount: number;
}

/**
 * One coordinate pair per routable itinerary item on a day. Used by
 * the V.UX.6 power-planner RouteMap so the polyline can recompute
 * locally on every drag.
 */
export class DayRouteCoordDto {
  @ApiProperty({ format: 'cuid' })
  declare itemId: string;

  @ApiProperty({ format: 'cuid' })
  declare placeId: string;

  @ApiProperty({ description: 'Latitude in decimal degrees.' })
  declare lat: number;

  @ApiProperty({ description: 'Longitude in decimal degrees.' })
  declare lng: number;
}

export class DayRouteCoordsResponseDto {
  @ApiProperty({
    type: [DayRouteCoordDto],
    description:
      "Routable items' coords in the day's current order. Items without a placeId are skipped.",
  })
  declare coords: DayRouteCoordDto[];
}

/**
 * Public-safe view returned by `GET /trips/shared/:code`. Notably omits
 * the owner's `userId` (only `ownerDisplayName` is exposed) and the
 * trip's center coordinates — the recipient gets the title, dates, and
 * itinerary needed to read the plan, nothing more. Days carry the same
 * `ItineraryDayDto` shape as the owner-only itinerary route.
 */
export class SharedTripDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Owner-chosen title.' })
  declare title: string;

  @ApiProperty({ description: 'Trip planning radius in km.' })
  declare radiusKm: number;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare startsOn: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare endsOn: string | null;

  @ApiProperty({ description: 'Display name of the owner who shared this trip.' })
  declare ownerDisplayName: string;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601 expiry for the share code itself, not the trip.',
  })
  declare expiresAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({
    type: [ItineraryDayDto],
    description: 'Itinerary days + items, ordered by dayIndex ascending.',
  })
  declare days: ItineraryDayDto[];
}

export class TripShareResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty({
    description: 'Opaque token; recipients hit `GET /trips/shared/:code` to view the trip.',
  })
  declare shareCode: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare expiresAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
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
