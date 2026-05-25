/**
 * V.UX.30 — overnight sweep that archives trips older than the
 * configured cutoff (default 365 days). Returns the count flipped
 * for telemetry.
 *
 * Installed by prompt [V.UX.30].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const DEFAULT_AGE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AutoArchiveResult {
  readonly archived: number;
  readonly cutoff: Date;
}

@Injectable()
export class AutoArchiveOldTripsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    now: Date = this.clock.now(),
    ageDays = DEFAULT_AGE_DAYS,
  ): Promise<AutoArchiveResult> {
    const cutoff = new Date(now.getTime() - ageDays * DAY_MS);
    const archived = await this.trips.autoArchiveOlderThan(cutoff);
    return { archived, cutoff };
  }
}
