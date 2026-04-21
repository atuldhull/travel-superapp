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
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SearchEventsUseCase } from '../application/search-events.use-case';
import type { EventListing } from '../domain/event-listing.entity';
import { SearchEventsBodySchema, type SearchEventsBody } from './dto/events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly searchEvents: SearchEventsUseCase) {}

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
    });
    return { events };
  }
}
