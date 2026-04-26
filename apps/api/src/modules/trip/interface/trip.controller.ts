/**
 * Trip HTTP surface — first real feature-module controller on top of
 * the Phase-0 foundation. Every route is protected by the global
 * JwtAuthGuard (no `@Public()`); `@CurrentUser()` gives us the
 * requesting user id.
 *
 * Surface (v1):
 *   - POST /api/v1/trips   — create a draft from { title, center, radiusKm }.
 *   - GET  /api/v1/trips   — list my trips (paginated by `limit`).
 *   - GET  /api/v1/trips/:id — fetch a single trip (404 if not mine).
 *
 * Itinerary generation is a follow-up. This controller returns the
 * bare `Trip` row; the itinerary lands when `[IV.18.2.4]` wires
 * `GenerateItineraryUseCase` into POST /trips/:id/itinerary.
 *
 * Installed by prompt [IV.18.2.3].
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotFoundError } from '@app/errors';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateTripDraftUseCase } from '../application/create-trip-draft.use-case';
import { CreateTripShareUseCase } from '../application/create-trip-share.use-case';
import { ListTripSharesUseCase } from '../application/list-trip-shares.use-case';
import { RevokeTripShareUseCase } from '../application/revoke-trip-share.use-case';
import { DeleteTripUseCase } from '../application/delete-trip.use-case';
import { GetTripEateriesUseCase } from '../application/get-trip-eateries.use-case';
import { GetTripEventsUseCase } from '../application/get-trip-events.use-case';
import { GetTripOverviewUseCase, type Section } from '../application/get-trip-overview.use-case';
import { GetTripStaysUseCase } from '../application/get-trip-stays.use-case';
import {
  GetTripTransportLegsUseCase,
  type TransportLeg,
} from '../application/get-trip-transport-legs.use-case';
import { GetTripWeatherUseCase } from '../application/get-trip-weather.use-case';
import type { EventListing } from '../../events/domain/event-listing.entity';
import type { EateryListing } from '../../food/domain/eatery-listing.entity';
import type { StayListing } from '../../stays/domain/stay-listing.entity';
import type { WeatherForecast } from '../../weather/domain/weather-forecast.entity';
import { GenerateItineraryStubUseCase } from '../application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from '../application/get-trip.use-case';
import { ListItineraryUseCase } from '../application/list-itinerary.use-case';
import { ListTripsUseCase } from '../application/list-trips.use-case';
import { ResolveTripShareUseCase } from '../application/resolve-trip-share.use-case';
import { UpdateDayItemsUseCase } from '../application/update-day-items.use-case';
import { UpdateTripUseCase } from '../application/update-trip.use-case';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import {
  TRIP_OVERVIEW_CACHE_TTL_SEC,
  TripOverviewCache,
} from '../infrastructure/trip-overview-cache';
import {
  CreateTripBodySchema,
  CreateTripShareBodySchema,
  UpdateDayItemsBodySchema,
  UpdateTripBodySchema,
  type CreateTripBody,
  type CreateTripShareBody,
  type UpdateDayItemsBody,
  type UpdateTripBody,
} from './dto/trip.dto';
import {
  CreateTripRequestDto,
  ListTripsResponseDto,
  TripDto as TripResponseDto,
  UpdateTripRequestDto,
} from './dto/trip-response.dto';

interface TripDto {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly status: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(t: Trip): TripDto {
  return {
    id: t.id,
    userId: t.userId,
    title: t.title,
    status: t.status,
    radiusKm: t.radiusKm,
    startsOn: t.startsOn ? t.startsOn.toISOString() : null,
    endsOn: t.endsOn ? t.endsOn.toISOString() : null,
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

@ApiTags('trip')
@ApiBearerAuth()
@Controller('trips')
export class TripController {
  constructor(
    private readonly createDraft: CreateTripDraftUseCase,
    private readonly listTrips: ListTripsUseCase,
    private readonly getTrip: GetTripUseCase,
    private readonly updateTrip: UpdateTripUseCase,
    private readonly deleteTrip: DeleteTripUseCase,
    private readonly generateItinerary: GenerateItineraryStubUseCase,
    private readonly listItinerary: ListItineraryUseCase,
    private readonly updateDayItems: UpdateDayItemsUseCase,
    private readonly createTripShare: CreateTripShareUseCase,
    private readonly resolveTripShare: ResolveTripShareUseCase,
    private readonly revokeTripShare: RevokeTripShareUseCase,
    private readonly listTripShares: ListTripSharesUseCase,
    private readonly getTripWeather: GetTripWeatherUseCase,
    private readonly getTripStays: GetTripStaysUseCase,
    private readonly getTripEateries: GetTripEateriesUseCase,
    private readonly getTripOverview: GetTripOverviewUseCase,
    private readonly getTripEvents: GetTripEventsUseCase,
    private readonly getTripTransportLegs: GetTripTransportLegsUseCase,
    private readonly tripOverviewCache: TripOverviewCache,
  ) {}

  @ApiOperation({
    summary: 'Create a trip draft from { title, center, radiusKm, startsOn?, endsOn? }',
  })
  @ApiBody({ type: CreateTripRequestDto })
  @ApiResponse({ status: 201, description: 'Trip created.', type: TripResponseDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateTripBodySchema))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTripBody,
  ): Promise<TripDto> {
    const trip = await this.createDraft.execute({
      userId: user.sub,
      title: body.title,
      center: body.center,
      radiusKm: body.radiusKm,
      ...(body.startsOn ? { startsOn: new Date(body.startsOn) } : {}),
      ...(body.endsOn ? { endsOn: new Date(body.endsOn) } : {}),
    });
    return toDto(trip);
  }

  @ApiOperation({ summary: "List the caller's trips, most-recent-first" })
  @ApiResponse({
    status: 200,
    description: 'Caller-owned trips, most-recent-first. ?limit=N (1..100, default 20).',
    type: ListTripsResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ trips: TripDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(100, Number(limit) || 20)) : 20;
    const trips = await this.listTrips.execute(user.sub, parsed);
    return { trips: trips.map(toDto) };
  }

  @ApiOperation({
    summary: 'Fetch a single trip the caller owns. 404 if missing or not theirs (IDOR-safe).',
  })
  @ApiResponse({ status: 200, description: 'The trip.', type: TripResponseDto })
  @ApiResponse({ status: 404, description: 'TRIP_NOT_FOUND.' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<TripDto> {
    const trip = await this.getTrip.execute(id, user.sub);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${id}`, { tripId: id }, 'TRIP_NOT_FOUND');
    }
    return toDto(trip);
  }

  @ApiOperation({
    summary: 'Update a trip the caller owns. Partial body; only provided fields change.',
  })
  @ApiBody({ type: UpdateTripRequestDto })
  @ApiResponse({ status: 200, description: 'Updated trip.', type: TripResponseDto })
  @ApiResponse({ status: 404, description: 'TRIP_NOT_FOUND.' })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    // Arg-scoped pipe: `@UsePipes` at handler level also runs the
    // Zod body schema against the `:id` path param (type='param'),
    // which fails with "Expected object, received string". Binding
    // the pipe to the `@Body` arg keeps it where it belongs.
    @Body(new ZodValidationPipe(UpdateTripBodySchema)) body: UpdateTripBody,
  ): Promise<TripDto> {
    const patch: {
      title?: string;
      radiusKm?: number;
      startsOn?: Date | null;
      endsOn?: Date | null;
    } = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.radiusKm !== undefined) patch.radiusKm = body.radiusKm;
    if ('startsOn' in body)
      patch.startsOn = body.startsOn === null ? null : new Date(body.startsOn!);
    if ('endsOn' in body) patch.endsOn = body.endsOn === null ? null : new Date(body.endsOn!);
    const trip = await this.updateTrip.execute({ tripId: id, userId: user.sub, patch });
    return toDto(trip);
  }

  @ApiOperation({
    summary: 'Delete a trip the caller owns. Cascades to itinerary days, items, shares.',
  })
  @ApiResponse({ status: 204, description: 'Trip deleted.' })
  @ApiResponse({ status: 404, description: 'TRIP_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteTrip.execute(id, user.sub);
  }

  /**
   * Generate (or re-generate) the itinerary skeleton for the trip.
   * Today this is a deterministic day-per-date stub; the AI-backed
   * version lands when the ai-service is real. Returns the fresh
   * list of days — empty `items`, non-null `summary`.
   */
  @ApiOperation({
    summary: 'Generate itinerary stub for the trip (one ItineraryDay per date in the range).',
  })
  @Post(':id/itinerary')
  @HttpCode(HttpStatus.OK)
  async buildItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ days: ItineraryDayDto[] }> {
    const { days } = await this.generateItinerary.execute({ tripId: id, userId: user.sub });
    return { days: days.map(toDayDto) };
  }

  @ApiOperation({ summary: 'List itinerary days + items for the trip the caller owns.' })
  @Get(':id/itinerary')
  @HttpCode(HttpStatus.OK)
  async getItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ days: ItineraryDayDto[] }> {
    const days = await this.listItinerary.execute(id, user.sub);
    return { days: days.map(toDayDto) };
  }

  /**
   * Edit the item list for a single day (reorder / add / remove /
   * wipe). Empty `items: []` clears the day. Cross-user / wrong
   * tripId → 404 `TRIP_NOT_FOUND`. Non-existent `placeId` → 404
   * `PLACE_NOT_FOUND`.
   */
  /**
   * Mint a share code for this trip. Recipient then hits the public
   * `GET /trips/shared/:code` route to read trip metadata without
   * authenticating. Owner-only — a non-owner hitting this path gets
   * 404 `TRIP_NOT_FOUND` (existence probe defence).
   */
  @ApiOperation({
    summary:
      'Mint a share code so collaborators can view (or co-edit, if publicRead=false) the trip.',
  })
  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  async share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateTripShareBodySchema)) body: CreateTripShareBody,
  ): Promise<TripShareDto> {
    const share = await this.createTripShare.execute({
      tripId: id,
      ownerId: user.sub,
      ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
    });
    return {
      id: share.id,
      tripId: share.tripId,
      shareCode: share.shareCode,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
      createdAt: share.createdAt.toISOString(),
    };
  }

  /**
   * Resolve a share code to the shared trip's public-safe view.
   * `@Public()` so unauthenticated recipients can hit it with just
   * the opaque code. Does NOT expose the owner's userId — only the
   * displayName so the recipient sees who shared with them. Includes
   * the itinerary (days + items) so the recipient actually sees the
   * plan, not just metadata.
   */
  @Public()
  @ApiOperation({ summary: 'Public read of a shared trip by code. No auth required.' })
  @Get('shared/:code')
  @HttpCode(HttpStatus.OK)
  async getSharedTrip(@Param('code') code: string): Promise<SharedTripDto> {
    const { trip, ownerDisplayName, expiresAt, days } = await this.resolveTripShare.execute(code);
    return {
      id: trip.id,
      title: trip.title,
      radiusKm: trip.radiusKm,
      startsOn: trip.startsOn ? trip.startsOn.toISOString() : null,
      endsOn: trip.endsOn ? trip.endsOn.toISOString() : null,
      ownerDisplayName,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      createdAt: trip.createdAt.toISOString(),
      days: days.map(toDayDto),
    };
  }

  /**
   * Bundled dashboard: trip metadata + itinerary + weather + stays
   * + eateries in one response. Each non-trip section is a
   * discriminated `{ ok: true, data } | { ok: false, code }` so a
   * sub-fetch failure (dead provider, dateless trip for stays, etc.)
   * degrades that one widget instead of 500-ing the whole screen.
   *
   * Owner gate runs once at the top; provider sub-calls never run
   * for non-owners / missing trips.
   */
  @ApiOperation({
    summary:
      'Trip overview composite — 7 sections (itinerary, weather, stays, eateries, events, transport, media). Per-section graceful degradation. 60s TTL cache.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Per-user-cached composite. Empty/dateless sections surface as { ok:false, code }.',
  })
  @Get(':id/overview')
  @HttpCode(HttpStatus.OK)
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TripOverviewDto> {
    // Per-user cache key — see `TripOverviewCache` JSDoc for the
    // collab-trip auth-posture rationale. Cache hit short-circuits
    // the 7-section composite fetch entirely; cache miss falls back
    // to the use-case + DTO mapping below.
    const cacheKey = `${id}:${user.sub}`;
    const cached = await this.tripOverviewCache.get(cacheKey);
    if (cached !== null) {
      return cached as TripOverviewDto;
    }

    const ov = await this.getTripOverview.execute(id, user.sub);
    const dto: TripOverviewDto = {
      trip: toDto(ov.trip),
      itinerary: mapSection(ov.itinerary, (days) => ({ days: days.map(toDayDto) })),
      weather: mapSection(ov.weather, (f) => ({ forecast: f })),
      stays: mapSection(ov.stays, (list) => ({ list })),
      eateries: mapSection(ov.eateries, (list) => ({ list })),
      events: mapSection(ov.events, (list) => ({ list })),
      transport: mapSection(ov.transport, (legs) => ({ legs })),
      media: mapSection(ov.media, (m) => ({
        count: m.count,
        recent: m.recent.map((a) => ({
          id: a.id,
          kind: a.kind,
          s3KeyRaw: a.s3KeyRaw,
          createdAt: a.createdAt.toISOString(),
        })),
      })),
    };
    await this.tripOverviewCache.set(cacheKey, dto, TRIP_OVERVIEW_CACHE_TTL_SEC);
    return dto;
  }

  /**
   * Eateries near the trip's center. Owner-only. Dates are NOT
   * required (unlike Trip × Stays) — "show me restaurants near my
   * trip" is meaningful regardless of when the trip is. Radius is
   * capped at 25km (Food's domain cap) even when the trip's own
   * radius reaches 500km.
   *
   * Optional query params: `cuisineTag` (string), `maxPriceTier` (1..5).
   */
  @ApiOperation({
    summary: 'Eateries near the trip center. Optional cuisineTag + maxPriceTier filters.',
  })
  @Get(':id/eateries')
  @HttpCode(HttpStatus.OK)
  async eateries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('cuisineTag') cuisineTag?: string,
    @Query('maxPriceTier') maxPriceTier?: string,
  ): Promise<{ eateries: readonly EateryListing[] }> {
    // Parse maxPriceTier from the query string ourselves — @Query
    // delivers strings regardless of type hints. `Number('') === 0`
    // so guard `=== undefined` first.
    const tier =
      maxPriceTier === undefined ? undefined : Math.max(1, Math.min(5, Number(maxPriceTier) || 1));
    const list = await this.getTripEateries.execute({
      tripId: id,
      userId: user.sub,
      ...(cuisineTag ? { cuisineTag } : {}),
      ...(tier !== undefined ? { maxPriceTier: tier } : {}),
    });
    return { eateries: list };
  }

  /**
   * Events happening near the trip's center during the trip's date
   * range. Owner-only. Requires `startsOn` + `endsOn` to be set
   * (422 `TRIP_DATES_REQUIRED` otherwise) — "what's on during my
   * trip" is the canonical question. Radius capped at 30km (Events'
   * domain cap). Optional `?category=` filter.
   */
  @ApiOperation({
    summary: 'Events near the trip center during the trip date range. Requires startsOn + endsOn.',
  })
  @ApiResponse({ status: 422, description: 'TRIP_DATES_REQUIRED.' })
  @Get(':id/events')
  @HttpCode(HttpStatus.OK)
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('category') category?: string,
  ): Promise<{ events: readonly EventListing[] }> {
    const list = await this.getTripEvents.execute({
      tripId: id,
      userId: user.sub,
      ...(category ? { category } : {}),
    });
    return { events: list };
  }

  /**
   * Stays near the trip's center, for the trip's date range. Owner-
   * only. Requires the trip to have both `startsOn` and `endsOn`
   * set (422 `TRIP_DATES_REQUIRED` otherwise) — stay availability
   * is intrinsically date-scoped. `radiusKm` is capped at 50km (the
   * stays-search domain invariant) even when the trip's own radius
   * reaches 500km.
   *
   * Optional `?guests=N` query param (default 1, max 20).
   */
  @ApiOperation({
    summary: 'Stays near the trip center for the trip date range. Requires startsOn + endsOn.',
  })
  @Get(':id/stays')
  @HttpCode(HttpStatus.OK)
  async stays(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('guests') guests?: string,
  ): Promise<{ stays: readonly StayListing[] }> {
    const parsed =
      guests === undefined ? undefined : Math.max(1, Math.min(20, Number(guests) || 1));
    const list = await this.getTripStays.execute({
      tripId: id,
      userId: user.sub,
      ...(parsed !== undefined ? { guests: parsed } : {}),
    });
    return { stays: list };
  }

  /**
   * Weather forecast for the trip's center. Owner-only. Day count
   * matches the trip's duration (capped at Open-Meteo's 16-day
   * ceiling); falls back to 7 when `startsOn` / `endsOn` aren't set.
   * Open-Meteo's forecast is "from today" — the UI aligns returned
   * ISO dates with the trip's date range.
   */
  @ApiOperation({ summary: 'Weather forecast for the trip center. Up to 16 days. TTL-cached.' })
  @Get(':id/weather')
  @HttpCode(HttpStatus.OK)
  async weather(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ forecast: WeatherForecast }> {
    const forecast = await this.getTripWeather.execute(id, user.sub);
    return { forecast };
  }

  /**
   * List every share (active + revoked) the caller has minted for
   * this trip. Owner-only — non-owner + missing collapse to 404
   * `TRIP_NOT_FOUND`, matching the existence-probe defence on every
   * other Trip endpoint.
   */
  @ApiOperation({ summary: 'List active share codes for the trip the caller owns.' })
  @Get(':id/shares')
  @HttpCode(HttpStatus.OK)
  async listShares(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ shares: TripShareOwnerDto[] }> {
    const shares = await this.listTripShares.execute(id, user.sub);
    return {
      shares: shares.map((s) => ({
        id: s.id,
        shareCode: s.shareCode,
        publicRead: s.publicRead,
        expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Revoke a previously-minted share code. Owner-only; missing /
   * non-owner collapse to 404 `SHARE_NOT_FOUND`. Soft-delete (flips
   * `publicRead = false` in the DB), so recipient sees the same
   * "not found" the unknown-code path returns.
   */
  @ApiOperation({ summary: 'Revoke a share code. Owner-scoped.' })
  @ApiParam({
    name: 'id',
    description: 'Trip id (validated implicitly via owner-scoped share lookup).',
  })
  @ApiParam({ name: 'code', description: 'Share code to revoke.' })
  @Delete(':id/share/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ): Promise<void> {
    await this.revokeTripShare.execute(code, user.sub);
  }

  /**
   * Transport options between consecutive itinerary items pinned
   * to Places. Owner-only. Pairs are silently skipped (NOT errored)
   * when an item has no `placeId`, when the place is missing from
   * the catalog, when origin === destination, or when the straight-
   * line distance exceeds 500km — all "no leg here" states for the
   * UI to render as a gap. Empty `legs: []` is the right answer
   * for a trip with no itinerary or only single-item days.
   */
  @ApiOperation({ summary: 'Compute transport legs between consecutive itinerary items.' })
  @Get(':id/transport-legs')
  @HttpCode(HttpStatus.OK)
  async transportLegs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ legs: readonly TransportLeg[] }> {
    const legs = await this.getTripTransportLegs.execute(id, user.sub);
    return { legs };
  }

  @ApiOperation({
    summary: 'Replace items in an itinerary day. Owner OR active TripShare may write.',
  })
  @Patch(':tripId/itinerary/:dayId')
  @HttpCode(HttpStatus.OK)
  async updateDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Param('dayId') dayId: string,
    @Body(new ZodValidationPipe(UpdateDayItemsBodySchema)) body: UpdateDayItemsBody,
  ): Promise<{ day: ItineraryDayDto }> {
    const day = await this.updateDayItems.execute({
      tripId,
      dayId,
      userId: user.sub,
      items: body.items.map((it) => ({
        position: it.position,
        placeId: it.placeId === undefined ? null : it.placeId,
        notes: it.notes ?? null,
      })),
    });
    return { day: toDayDto(day) };
  }
}

interface ItineraryItemDto {
  readonly id: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly notes: string | null;
}

interface ItineraryDayDto {
  readonly id: string;
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: string;
  readonly summary: string | null;
  readonly items: readonly ItineraryItemDto[];
}

interface TripShareDto {
  readonly id: string;
  readonly tripId: string;
  readonly shareCode: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

interface TripShareOwnerDto {
  readonly id: string;
  readonly shareCode: string;
  readonly publicRead: boolean;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

interface SharedTripDto {
  readonly id: string;
  readonly title: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly ownerDisplayName: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly days: readonly ItineraryDayDto[];
}

type SectionDto<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string };

interface TripMediaDto {
  readonly count: number;
  readonly recent: ReadonlyArray<{
    readonly id: string;
    readonly kind: 'image' | 'video';
    readonly s3KeyRaw: string;
    readonly createdAt: string;
  }>;
}

interface TripOverviewDto {
  readonly trip: TripDto;
  readonly itinerary: SectionDto<{ readonly days: readonly ItineraryDayDto[] }>;
  readonly weather: SectionDto<{ readonly forecast: WeatherForecast }>;
  readonly stays: SectionDto<{ readonly list: readonly StayListing[] }>;
  readonly eateries: SectionDto<{ readonly list: readonly EateryListing[] }>;
  readonly events: SectionDto<{ readonly list: readonly EventListing[] }>;
  readonly transport: SectionDto<{ readonly legs: readonly TransportLeg[] }>;
  readonly media: SectionDto<TripMediaDto>;
}

function mapSection<T, U>(s: Section<T>, f: (t: T) => U): SectionDto<U> {
  return s.ok ? { ok: true, data: f(s.data) } : { ok: false, code: s.code };
}

function toDayDto(d: ItineraryDay): ItineraryDayDto {
  return {
    id: d.id,
    tripId: d.tripId,
    dayIndex: d.dayIndex,
    date: d.date.toISOString(),
    summary: d.summary,
    items: d.items.map((i) => ({
      id: i.id,
      position: i.position,
      placeId: i.placeId,
      startTime: i.startTime ? i.startTime.toISOString() : null,
      endTime: i.endTime ? i.endTime.toISOString() : null,
      notes: i.notes,
    })),
  };
}
