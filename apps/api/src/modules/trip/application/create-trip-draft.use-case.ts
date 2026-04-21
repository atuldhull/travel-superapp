/**
 * Create a Trip in `draft` status. First real consumer of the full
 * Phase-0 stack: JwtAuthGuard + ZodValidationPipe + DomainError +
 * GeoQueries + PrismaService.
 *
 * Domain invariants:
 *   - Radius must be in (0, 500] km (Playbook §11.2).
 *   - Title max 120 chars (controller DTO enforces this too).
 *   - `startsOn` / `endsOn` are optional; if both present, startsOn <=
 *     endsOn. Out-of-order ranges → `ValidationError`.
 *
 * Itinerary generation (GenerateItineraryUseCase that calls the AI
 * sidecar) is a separate prompt — this use-case only creates the
 * draft skeleton. The controller returns the fresh `Trip` row;
 * downstream prompts will plug generation + persistence of
 * `ItineraryDay`/`ItineraryItem` in behind the same port.
 *
 * Installed by prompt [IV.18.2.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { InvalidRadiusError, ValidationError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import type { Trip } from '../domain/trip.entity';
import { makeEvent, type TripDraftedEvent } from '../domain/trip.events';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const MAX_RADIUS_KM = 500;

export interface CreateTripDraftCommand {
  readonly userId: string;
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly startsOn?: Date | null;
  readonly endsOn?: Date | null;
}

@Injectable()
export class CreateTripDraftUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: CreateTripDraftCommand): Promise<Trip> {
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be a positive number',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_RADIUS_KM) {
      throw new InvalidRadiusError(cmd.radiusKm, MAX_RADIUS_KM);
    }
    if (cmd.startsOn && cmd.endsOn && cmd.startsOn.getTime() > cmd.endsOn.getTime()) {
      throw new ValidationError(
        'startsOn must be before endsOn',
        { dateRange: ['startsOn > endsOn'] },
        { startsOn: cmd.startsOn.toISOString(), endsOn: cmd.endsOn.toISOString() },
        'INVALID_DATE_RANGE',
      );
    }
    const trip = await this.trips.createDraft({
      userId: cmd.userId,
      title: cmd.title,
      lat: cmd.center.lat,
      lng: cmd.center.lng,
      radiusKm: cmd.radiusKm,
      startsOn: cmd.startsOn ?? null,
      endsOn: cmd.endsOn ?? null,
    });

    // Emit AFTER the DB write settles so subscribers never see a
    // Trip that doesn't exist yet. `publish` is fire-and-forget
    // per the port contract — caller doesn't block on handlers.
    const evt: TripDraftedEvent = makeEvent(
      'Trip.TripDrafted',
      {
        tripId: trip.id,
        userId: trip.userId,
        title: trip.title,
        radiusKm: trip.radiusKm,
      },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    await this.events.publish(evt);

    return trip;
  }
}
