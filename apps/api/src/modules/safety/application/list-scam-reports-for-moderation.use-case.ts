/**
 * Admin-facing list of ScamReport rows for the moderation queue.
 * Defaults to pending-only (verified=false); admins can pass
 * `verified: true` to audit the already-verified pile.
 *
 * No coord filter — moderation is a text review job ("is this
 * spam? is this a real report?"), not a geo filter. Most-recent-
 * first, default 50, cap 200.
 *
 * Installed by prompt [IV.18.11.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ScamReport } from '../domain/scam-report.entity';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface ListScamReportsForModerationCommand {
  readonly verified?: boolean;
  readonly limit?: number;
}

export interface ListScamReportsForModerationResult {
  readonly reports: readonly ScamReport[];
  /** True backlog size for the filter — the `reports` list is capped, this is not. */
  readonly total: number;
}

@Injectable()
export class ListScamReportsForModerationUseCase {
  constructor(@Inject(SCAM_REPORT_REPOSITORY) private readonly repo: ScamReportRepository) {}

  async execute(
    cmd: ListScamReportsForModerationCommand = {},
  ): Promise<ListScamReportsForModerationResult> {
    const clamped =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const [reports, total] = await Promise.all([
      this.repo.listForModeration({
        ...(cmd.verified !== undefined ? { verified: cmd.verified } : {}),
        limit: clamped,
      }),
      this.repo.countForModeration(cmd.verified),
    ]);
    return { reports, total };
  }
}
