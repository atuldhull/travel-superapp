/**
 * Search events within a radius of a coord, for a time window.
 * Validation + clamping only; caching lives in the decorator.
 *
 * Window policy:
 *   - `from` / `to` must parse as ISO-8601 datetimes.
 *   - `to > from` (strict — zero-length windows aren't useful).
 *   - Window ≤ 90 days (avoids fanning provider quotas over
 *     arbitrary ranges; real users searching for events don't
 *     ask for "the next year" interactively).
 *
 * Radius cap 30km — events are usually an evening-out scope, not a
 * day-trip scope.
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { EventListing } from '../domain/event-listing.entity';
import { EVENT_PROVIDER, type EventProvider } from './ports/event-provider';

const MAX_RADIUS_KM = 30;
const MAX_WINDOW_DAYS = 90;

export interface SearchEventsCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly from: string;
  readonly to: string;
  readonly category?: string;
}

@Injectable()
export class SearchEventsUseCase {
  constructor(@Inject(EVENT_PROVIDER) private readonly provider: EventProvider) {}

  async execute(cmd: SearchEventsCommand): Promise<readonly EventListing[]> {
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
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be positive',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_RADIUS_KM) {
      throw new ValidationError(
        `Radius too large (max ${MAX_RADIUS_KM}km)`,
        { radiusKm: [`must be ≤ ${MAX_RADIUS_KM}`] },
        { radiusKm: cmd.radiusKm, max: MAX_RADIUS_KM },
        'INVALID_RADIUS',
      );
    }

    const fromMs = Date.parse(cmd.from);
    const toMs = Date.parse(cmd.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      throw new ValidationError(
        'from/to must be ISO-8601 datetimes',
        { from: ['invalid datetime'], to: ['invalid datetime'] },
        { from: cmd.from, to: cmd.to },
        'INVALID_DATE_RANGE',
      );
    }
    if (toMs <= fromMs) {
      throw new ValidationError(
        'to must be after from',
        { to: ['must be after from'] },
        { from: cmd.from, to: cmd.to },
        'INVALID_DATE_RANGE',
      );
    }
    const windowDays = (toMs - fromMs) / 86_400_000;
    if (windowDays > MAX_WINDOW_DAYS) {
      throw new ValidationError(
        `Window too long (max ${MAX_WINDOW_DAYS} days)`,
        { to: [`must be within ${MAX_WINDOW_DAYS} days of from`] },
        { windowDays, max: MAX_WINDOW_DAYS },
        'INVALID_DATE_RANGE',
      );
    }

    return this.provider.searchNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      from: cmd.from,
      to: cmd.to,
      ...(cmd.category ? { category: cmd.category } : {}),
    });
  }
}
