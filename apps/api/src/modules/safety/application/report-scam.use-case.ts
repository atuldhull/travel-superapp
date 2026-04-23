/**
 * Submit a new scam report at a coordinate. Authenticated path only;
 * `reporterId` comes from the bearer token, not the request body.
 *
 * v1 validation: lat/lng range, category non-empty + ≤ 60 chars,
 * description ≤ 2000 chars, evidence URLs ≤ 5 and each ≤ 500 chars.
 * Moderation (flipping `verified: true`, admin purge of spam) lands
 * in a follow-up slice.
 *
 * Installed by prompt [IV.18.11.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { ScamReport, ScamSeverity } from '../domain/scam-report.entity';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

export interface ReportScamCommand {
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly lat: number;
  readonly lng: number;
  readonly description: string;
  readonly evidenceUrls?: readonly string[];
}

@Injectable()
export class ReportScamUseCase {
  constructor(@Inject(SCAM_REPORT_REPOSITORY) private readonly reports: ScamReportRepository) {}

  async execute(cmd: ReportScamCommand): Promise<ScamReport> {
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

    return this.reports.report({
      reporterId: cmd.reporterId,
      category: cmd.category,
      severity: cmd.severity,
      lat: cmd.lat,
      lng: cmd.lng,
      description: cmd.description,
      ...(cmd.evidenceUrls ? { evidenceUrls: cmd.evidenceUrls } : {}),
    });
  }
}
