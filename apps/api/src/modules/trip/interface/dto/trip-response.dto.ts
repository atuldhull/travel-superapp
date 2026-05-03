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

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description:
      'V.UX.30 — non-null when the trip is soft-archived (auto-sweep > 365 days OR manual). Default lister filters non-null out.',
  })
  declare archivedAt: string | null;

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

  @ApiProperty({
    type: [TripDto],
    description:
      'V.UX.9 — trips someone else owns but the caller participates in via a vote or expense.',
  })
  declare collaborated: TripDto[];
}

/**
 * V.UX.9 — `GET /trips/:id` now returns the trip plus the caller's
 * role. Owner = creator; collaborator = non-owner with active
 * trip-share access (caller has voted / expensed, or the trip has a
 * publicly-active share).
 *
 * Installed by prompt [V.UX.9].
 */
export class TripWithRoleResponseDto {
  @ApiProperty({ type: TripDto })
  declare trip: TripDto;

  @ApiProperty({ description: '"owner" or "collaborator".' })
  declare role: string;

  @ApiProperty({
    nullable: true,
    description: "Display name of the trip's owner — surfaced for collaborator banners.",
  })
  declare ownerDisplayName: string | null;
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
 * V.UX.7 spontaneous-improviser composite. POST /near-me. Public,
 * no auth, no DB writes. Single request answers "what's near me +
 * how do I get there + is it safe + is it raining".
 *
 * Installed by prompt [V.UX.7].
 */
export class NearMeNowCenterDto {
  @ApiProperty({ description: 'Caller latitude.', minimum: -90, maximum: 90 })
  declare lat: number;

  @ApiProperty({ description: 'Caller longitude.', minimum: -180, maximum: 180 })
  declare lng: number;
}

export class NearMeNowRequestDto {
  @ApiProperty({ type: NearMeNowCenterDto })
  declare center: NearMeNowCenterDto;

  @ApiProperty({
    required: false,
    minimum: 0.5,
    maximum: 10,
    description: 'Walking radius in km. Defaults to 3, caps at 10.',
  })
  declare radiusKm?: number;
}

export class NearMeRouteLegDto {
  @ApiProperty({ description: 'Transport mode (walk / public_transit / taxi / ...).' })
  declare mode: string;

  @ApiProperty({ description: 'Straight-line travel distance, metres.' })
  declare distanceMeters: number;

  @ApiProperty({ description: 'Estimated travel duration, seconds.' })
  declare durationSeconds: number;

  @ApiProperty({ nullable: true, description: 'Provider-derived USD estimate (null when free).' })
  declare estimatedCostUsd: number | null;

  @ApiProperty({ description: 'Provider confidence: high / medium / low.' })
  declare confidence: string;
}

export class NearMePlaceDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Place name.' })
  declare name: string;

  @ApiProperty({ description: 'Category ("cafe", "park", ...).' })
  declare category: string;

  @ApiProperty({ description: 'Latitude.' })
  declare lat: number;

  @ApiProperty({ description: 'Longitude.' })
  declare lng: number;

  @ApiProperty({ description: 'Straight-line distance from caller, metres.' })
  declare distanceMeters: number;

  @ApiProperty({
    type: [NearMeRouteLegDto],
    description:
      'Walking-preferred routes from caller to this place. Empty array when routing fails.',
  })
  declare routes: NearMeRouteLegDto[];
}

export class NearMeWeatherDayDto {
  @ApiProperty({ description: 'ISO date (forecast timezone).', format: 'date' })
  declare date: string;

  @ApiProperty({ description: 'Forecast high in °C.' })
  declare maxTempC: number;

  @ApiProperty({ description: 'Forecast low in °C.' })
  declare minTempC: number;

  @ApiProperty({ description: 'WMO weather code (Open-Meteo).' })
  declare weatherCode: number;

  @ApiProperty({
    nullable: true,
    description: '0–100 probability of precipitation, or null when unavailable.',
  })
  declare precipitationProbabilityPercent: number | null;
}

export class NearMeWeatherDto {
  @ApiProperty({ description: 'Latitude (caller).' })
  declare lat: number;

  @ApiProperty({ description: 'Longitude (caller).' })
  declare lng: number;

  @ApiProperty({ description: 'IANA timezone resolved by the weather provider.' })
  declare timezone: string;

  @ApiProperty({ type: [NearMeWeatherDayDto], description: 'Daily forecast (1 day for near-me).' })
  declare days: NearMeWeatherDayDto[];
}

export class NearMeSafetyBreakdownDto {
  @ApiProperty({ description: 'Total crime incidents in the radius/time window.' })
  declare crimes: number;

  @ApiProperty({ description: 'Total scam reports in the radius.' })
  declare scams: number;
}

export class NearMeSafetyDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  declare score: number;

  @ApiProperty({ description: 'A/B/C/D/F letter grade.' })
  declare grade: string;

  @ApiProperty({ type: NearMeSafetyBreakdownDto })
  declare breakdown: NearMeSafetyBreakdownDto;

  @ApiProperty({ description: 'Radius the score covers, km.' })
  declare radiusKm: number;
}

export class NearMeNowResponseDto {
  @ApiProperty({ type: NearMeNowCenterDto })
  declare center: NearMeNowCenterDto;

  @ApiProperty({ description: 'Search radius (after clamp), km.' })
  declare radiusKm: number;

  @ApiProperty({ type: [NearMePlaceDto], description: 'Up to 5 nearest places.' })
  declare places: NearMePlaceDto[];

  @ApiProperty({ type: NearMeWeatherDto })
  declare weather: NearMeWeatherDto;

  @ApiProperty({ type: NearMeSafetyDto })
  declare safety: NearMeSafetyDto;

  @ApiProperty({ format: 'date-time' })
  declare fetchedAt: string;
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
 * Owner-side share row. Same as TripShareResponseDto plus `publicRead`
 * (false when the share has been revoked). Used by `GET /trips/:id/shares`.
 *
 * Installed by prompt [V.UX.8].
 */
export class TripShareOwnerDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty()
  declare shareCode: string;

  @ApiProperty({ description: 'False = revoked.' })
  declare publicRead: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare expiresAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ListTripSharesResponseDto {
  @ApiProperty({
    type: [TripShareOwnerDto],
    description: 'Every share the owner has minted (active + revoked).',
  })
  declare shares: TripShareOwnerDto[];
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
