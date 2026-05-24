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
import { assertValidCoordinates } from '../../../common/geo/haversine';
import { ScamReport, type ScamSeverity } from '../domain/scam-report.entity';
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
    // [J2] coordinate range guard lives in common/geo/haversine.ts;
    // shared with trigger-sos + future geo callers.
    assertValidCoordinates(cmd.lat, cmd.lng);
    // Domain-side invariants (S1-S5 — [G4.2]).
    const input = ScamReport.create({
      reporterId: cmd.reporterId,
      category: cmd.category,
      severity: cmd.severity,
      description: cmd.description,
      ...(cmd.evidenceUrls ? { evidenceUrls: cmd.evidenceUrls } : {}),
    });

    return this.reports.report({
      reporterId: input.reporterId,
      category: input.category,
      severity: input.severity,
      lat: cmd.lat,
      lng: cmd.lng,
      description: input.description,
      ...(input.evidenceUrls ? { evidenceUrls: input.evidenceUrls } : {}),
    });
  }
}
