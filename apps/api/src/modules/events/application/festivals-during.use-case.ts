/**
 * V.UX.22 — cultural / religious tourist surface. Returns every
 * `category=festival` event whose window overlaps `[from, to]` near
 * a centre. Same input bounds as `SearchEventsUseCase` (radius cap
 * + 90-day window cap); the only behavioural difference is the
 * category is fixed server-side, so the client can't ask for
 * "search festivals matching category=music" by mistake.
 *
 * Powers the "🎉 festival today" overlay on `/trips/[id]` day
 * cards — the trip page asks once for the trip's date range and
 * folds matches into each day-card row.
 *
 * Installed by prompt [V.UX.22].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { EventListing } from '../domain/event-listing.entity';
import { EVENT_PROVIDER, type EventProvider } from './ports/event-provider';

const MAX_RADIUS_KM = 30;
const MAX_WINDOW_DAYS = 90;
const FESTIVAL_CATEGORY = 'festival';

export interface FestivalsDuringCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly from: string;
  readonly to: string;
}

@Injectable()
export class FestivalsDuringUseCase {
  constructor(@Inject(EVENT_PROVIDER) private readonly provider: EventProvider) {}

  async execute(cmd: FestivalsDuringCommand): Promise<readonly EventListing[]> {
    if (!Number.isFinite(cmd.lat) || cmd.lat < -90 || cmd.lat > 90) {
      throw new ValidationError(
        'Latitude out of range',
        { lat: ['must be between -90 and 90'] },
        { lat: cmd.lat },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.lng) || cmd.lng < -180 || cmd.lng > 180) {
      throw new ValidationError(
        'Longitude out of range',
        { lng: ['must be between -180 and 180'] },
        { lng: cmd.lng },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0 || cmd.radiusKm > MAX_RADIUS_KM) {
      throw new ValidationError(
        `Radius must be in (0, ${MAX_RADIUS_KM}]`,
        { radiusKm: ['out of range'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    const fromMs = Date.parse(cmd.from);
    const toMs = Date.parse(cmd.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
      throw new ValidationError(
        'from/to must be ISO-8601 datetimes with to > from',
        { from: ['invalid datetime'], to: ['invalid datetime'] },
        { from: cmd.from, to: cmd.to },
        'INVALID_DATE_RANGE',
      );
    }
    if ((toMs - fromMs) / 86_400_000 > MAX_WINDOW_DAYS) {
      throw new ValidationError(
        `Window too long (max ${MAX_WINDOW_DAYS} days)`,
        { to: [`must be within ${MAX_WINDOW_DAYS} days of from`] },
        { from: cmd.from, to: cmd.to },
        'INVALID_DATE_RANGE',
      );
    }

    return this.provider.searchNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      from: cmd.from,
      to: cmd.to,
      category: FESTIVAL_CATEGORY,
    });
  }
}
