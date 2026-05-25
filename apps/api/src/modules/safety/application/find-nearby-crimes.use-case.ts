/**
 * Find CrimeIncident rows near a coordinate, ordered by distance.
 * Mirrors the `FindNearbyScamsUseCase` shape — same validation
 * rules, same response envelope, same limit semantics. Differs
 * only in the data source: crime rows come from external upstream
 * data (government feeds, Numbeo), not user reports.
 *
 * `sinceDays` is crime-specific — a "last 90 days" window is the
 * canonical view for a safety dashboard since raw feeds tend to
 * include long-tail historical data that's useful for analytics
 * but noise for a traveler deciding where to walk tonight.
 *
 * Installed by prompt [IV.18.11.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import type { CrimeIncidentWithDistance, ScamSeverity } from '../domain/crime-incident.entity';
import {
  CRIME_INCIDENT_REPOSITORY,
  type CrimeIncidentRepository,
} from './ports/crime-incident.repository';

const MAX_RADIUS_KM = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FindNearbyCrimesCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly category?: string;
  readonly minSeverity?: ScamSeverity;
  readonly sinceDays?: number;
  readonly limit?: number;
}

@Injectable()
export class FindNearbyCrimesUseCase {
  constructor(
    @Inject(CRIME_INCIDENT_REPOSITORY) private readonly crimes: CrimeIncidentRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: FindNearbyCrimesCommand): Promise<readonly CrimeIncidentWithDistance[]> {
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
    if (cmd.sinceDays !== undefined && (!Number.isFinite(cmd.sinceDays) || cmd.sinceDays <= 0)) {
      throw new ValidationError(
        'sinceDays must be positive',
        { sinceDays: ['must be > 0'] },
        { sinceDays: cmd.sinceDays },
        'INVALID_SINCE_DAYS',
      );
    }

    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));

    const since =
      cmd.sinceDays === undefined
        ? undefined
        : new Date(this.clock.nowMs() - cmd.sinceDays * MS_PER_DAY);

    const rows = await this.crimes.findNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.category || cmd.minSeverity || since
        ? {
            filters: {
              ...(cmd.category ? { category: cmd.category } : {}),
              ...(cmd.minSeverity ? { minSeverity: cmd.minSeverity } : {}),
              ...(since ? { since } : {}),
            },
          }
        : {}),
    });
    return rows.slice(0, limit);
  }
}
