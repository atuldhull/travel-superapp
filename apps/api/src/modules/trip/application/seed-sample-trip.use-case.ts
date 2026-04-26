/**
 * Seed a single read-only "Sample trip" for a brand-new user.
 *
 * Purpose: first-run onboarding (`[V.UX.3]`). When the user skips the
 * 3-step wizard, we still want their `/trips` page to feel populated
 * and demonstrate the trip mental model. We drop a Goa weekend
 * sample with a recognizable title prefix so the web client can show
 * a "Sample trip" badge and a subtle "Delete" affordance.
 *
 * Idempotent: returns `false` (created=false) if the user already has
 * any trips. The caller (typically the onboarding-complete flow)
 * doesn't need to gate.
 *
 * Read-only is enforced UX-side via the title prefix; the server
 * happily lets the user delete it (the spec calls for "deletable").
 *
 * Installed by prompt [V.UX.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CreateTripDraftUseCase, type CreateTripDraftCommand } from './create-trip-draft.use-case';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const SAMPLE_TITLE = 'Sample trip — Goa weekend';

/**
 * Goa coordinates roughly aligned with the SampleTripDemo presets
 * on the landing page so the user sees a city they may have already
 * previewed pre-signup.
 */
const SAMPLE_TRIP: Omit<CreateTripDraftCommand, 'userId'> = {
  title: SAMPLE_TITLE,
  center: { lat: 15.2993, lng: 74.124 },
  radiusKm: 25,
};

@Injectable()
export class SeedSampleTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    private readonly createDraft: CreateTripDraftUseCase,
  ) {}

  async execute(userId: string): Promise<{ readonly created: boolean }> {
    const existing = await this.trips.listByUser(userId, 1);
    if (existing.length > 0) return { created: false };

    // Compute the next Saturday + Sunday so the sample looks fresh
    // every time it's seeded (rather than a stale 2026 date).
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sun, 6 = Sat
    const daysToSaturday = (6 - day + 7) % 7 || 7;
    const startsOn = new Date(now);
    startsOn.setUTCDate(now.getUTCDate() + daysToSaturday);
    startsOn.setUTCHours(0, 0, 0, 0);
    const endsOn = new Date(startsOn);
    endsOn.setUTCDate(startsOn.getUTCDate() + 1);

    await this.createDraft.execute({
      userId,
      title: SAMPLE_TRIP.title,
      center: SAMPLE_TRIP.center,
      radiusKm: SAMPLE_TRIP.radiusKm,
      startsOn,
      endsOn,
    });
    return { created: true };
  }
}

/**
 * Exported so the web client + tests can recognize a sample trip
 * by title prefix without an extra DB column.
 */
export const SAMPLE_TRIP_TITLE_PREFIX = 'Sample trip — ';
