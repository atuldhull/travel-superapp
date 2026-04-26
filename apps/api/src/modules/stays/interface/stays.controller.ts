/**
 * Stays HTTP surface — v1 is search-only. Booking + history land
 * in a later slice with their own controllers.
 *
 * Authenticated so the global rate limiter can key on user.sub +
 * every upstream-provider call is attributable.
 *
 *   POST /api/v1/stays/search
 *     body: { center: {lat,lng}, radiusKm, checkIn, checkOut, guests? }
 *     200 → { stays: StayListing[] }
 *     422 → INVALID_COORDINATES | INVALID_RADIUS | INVALID_DATE_RANGE
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SearchStaysUseCase } from '../application/search-stays.use-case';
import type { StayListing } from '../domain/stay-listing.entity';
import { SearchStaysBodySchema, type SearchStaysBody } from './dto/stays.dto';
import { SearchStaysRequestDto, SearchStaysResponseDto } from './dto/stays-response.dto';

@ApiTags('stays')
@ApiBearerAuth()
@Controller('stays')
export class StaysController {
  constructor(private readonly searchStays: SearchStaysUseCase) {}

  @ApiOperation({
    summary: 'Search stays within a radius for the given check-in/out window.',
  })
  @ApiBody({ type: SearchStaysRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Matching stays, nearest-first.',
    type: SearchStaysResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'INVALID_COORDINATES | INVALID_RADIUS | INVALID_DATE_RANGE.',
  })
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    // Arg-scoped pipe — same [IV.18.2.5.fix] pattern the rest of the
    // app uses so the schema only runs against @Body.
    @Body(new ZodValidationPipe(SearchStaysBodySchema)) body: SearchStaysBody,
  ): Promise<{ stays: readonly StayListing[] }> {
    const stays = await this.searchStays.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      radiusKm: body.radiusKm,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      ...(body.guests !== undefined ? { guests: body.guests } : {}),
    });
    return { stays };
  }
}
