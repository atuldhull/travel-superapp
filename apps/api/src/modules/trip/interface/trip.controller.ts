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
import { NotFoundError } from '@app/errors';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateTripDraftUseCase } from '../application/create-trip-draft.use-case';
import { DeleteTripUseCase } from '../application/delete-trip.use-case';
import { GenerateItineraryStubUseCase } from '../application/generate-itinerary-stub.use-case';
import { GetTripUseCase } from '../application/get-trip.use-case';
import { ListItineraryUseCase } from '../application/list-itinerary.use-case';
import { ListTripsUseCase } from '../application/list-trips.use-case';
import { UpdateTripUseCase } from '../application/update-trip.use-case';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import {
  CreateTripBodySchema,
  UpdateTripBodySchema,
  type CreateTripBody,
  type UpdateTripBody,
} from './dto/trip.dto';

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
  ) {}

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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<TripDto> {
    const trip = await this.getTrip.execute(id, user.sub);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${id}`, { tripId: id }, 'TRIP_NOT_FOUND');
    }
    return toDto(trip);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(UpdateTripBodySchema))
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTripBody,
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
  @Post(':id/itinerary')
  @HttpCode(HttpStatus.OK)
  async buildItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ days: ItineraryDayDto[] }> {
    const { days } = await this.generateItinerary.execute({ tripId: id, userId: user.sub });
    return { days: days.map(toDayDto) };
  }

  @Get(':id/itinerary')
  @HttpCode(HttpStatus.OK)
  async getItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ days: ItineraryDayDto[] }> {
    const days = await this.listItinerary.execute(id, user.sub);
    return { days: days.map(toDayDto) };
  }
}

interface ItineraryDayDto {
  readonly id: string;
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: string;
  readonly summary: string | null;
}

function toDayDto(d: ItineraryDay): ItineraryDayDto {
  return {
    id: d.id,
    tripId: d.tripId,
    dayIndex: d.dayIndex,
    date: d.date.toISOString(),
    summary: d.summary,
  };
}
