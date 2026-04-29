/**
 * Events HTTP surface. v1 is search-only.
 *
 *   POST /api/v1/events/search
 *     body: { center, radiusKm, from, to, category? }
 *     200 → { events: EventListing[] }
 *     422 → INVALID_COORDINATES | INVALID_RADIUS | INVALID_DATE_RANGE
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { FestivalsDuringUseCase } from '../application/festivals-during.use-case';
import { SearchEventsUseCase } from '../application/search-events.use-case';
import type { EventListing } from '../domain/event-listing.entity';
import {
  FestivalsDuringQuerySchema,
  SearchEventsBodySchema,
  type FestivalsDuringQuery,
  type SearchEventsBody,
} from './dto/events.dto';
import {
  FestivalsDuringResponseDto,
  SearchEventsRequestDto,
  SearchEventsResponseDto,
} from './dto/events-response.dto';

const DEFAULT_FESTIVAL_RADIUS_KM = 30;

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly searchEvents: SearchEventsUseCase,
    private readonly festivalsDuring: FestivalsDuringUseCase,
  ) {}

  @ApiOperation({ summary: 'Search events within a radius and date window.' })
  @ApiBody({ type: SearchEventsRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Matching events, soonest-first.',
    type: SearchEventsResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'INVALID_COORDINATES | INVALID_RADIUS | INVALID_DATE_RANGE.',
  })
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body(new ZodValidationPipe(SearchEventsBodySchema)) body: SearchEventsBody,
  ): Promise<{ events: readonly EventListing[] }> {
    const events = await this.searchEvents.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      radiusKm: body.radiusKm,
      from: body.from,
      to: body.to,
      ...(body.category ? { category: body.category } : {}),
      ...(body.freeOnly === true ? { freeOnly: true } : {}),
    });
    return { events };
  }

  /**
   * V.UX.22 — list festival events overlapping the given window.
   * Server-side fixes `category=festival`, so this is a stricter
   * surface than `/events/search` even when callers control the
   * other params. Powers the day-card overlay on /trips/[id].
   */
  @ApiOperation({
    summary:
      'List festival events overlapping [from, to] near a centre. Powers the day-card overlay on trip pages.',
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  @ApiQuery({ name: 'from', type: String, required: true, description: 'ISO-8601 datetime.' })
  @ApiQuery({ name: 'to', type: String, required: true, description: 'ISO-8601 datetime.' })
  @ApiResponse({
    status: 200,
    description: 'Festivals overlapping the window, soonest-first.',
    type: FestivalsDuringResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'INVALID_COORDINATES | INVALID_RADIUS | INVALID_DATE_RANGE.',
  })
  @Get('festivals')
  @HttpCode(HttpStatus.OK)
  async festivals(
    @Query(new ZodValidationPipe(FestivalsDuringQuerySchema)) query: FestivalsDuringQuery,
  ): Promise<{ festivals: readonly EventListing[] }> {
    const festivals = await this.festivalsDuring.execute({
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm ?? DEFAULT_FESTIVAL_RADIUS_KM,
      from: query.from,
      to: query.to,
    });
    return { festivals };
  }
}
