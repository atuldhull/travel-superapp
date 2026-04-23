/**
 * Find scam reports near a coordinate, ordered by distance. Results
 * are public to all authenticated users — the whole point of
 * crowd-sourced scam reports is that every traveler sees them.
 *
 * v1 domain rules:
 *   - radiusKm in (0, 50]. Broader than walk-distance because scam
 *     patterns cluster at the city scale (pickpocket district,
 *     overcharging tourist trap), not the block scale.
 *   - Optional `category` exact-match filter.
 *   - Optional `minSeverity` threshold — `medium` returns
 *     medium/high/critical; useful for "hide low-severity reports
 *     unless explicitly asked."
 *   - `limit` in [1, 200], default 50. Higher than the place-search
 *     default because markers on a safety layer render densely.
 *
 * Installed by prompt [IV.18.11.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { ScamReportWithDistance, ScamSeverity } from '../domain/scam-report.entity';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

const MAX_RADIUS_KM = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface FindNearbyScamsCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly category?: string;
  readonly minSeverity?: ScamSeverity;
  readonly limit?: number;
}

@Injectable()
export class FindNearbyScamsUseCase {
  constructor(@Inject(SCAM_REPORT_REPOSITORY) private readonly reports: ScamReportRepository) {}

  async execute(cmd: FindNearbyScamsCommand): Promise<readonly ScamReportWithDistance[]> {
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

    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));

    const rows = await this.reports.findNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.category || cmd.minSeverity
        ? {
            filters: {
              ...(cmd.category ? { category: cmd.category } : {}),
              ...(cmd.minSeverity ? { minSeverity: cmd.minSeverity } : {}),
            },
          }
        : {}),
    });
    return rows.slice(0, limit);
  }
}
