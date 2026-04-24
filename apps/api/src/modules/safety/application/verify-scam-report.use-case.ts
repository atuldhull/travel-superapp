/**
 * Flip a ScamReport's `verified` flag. `verified: true` marks it
 * as moderator-approved (the future `?verifiedOnly` filter on the
 * public search will key off this); `verified: false` revokes
 * approval (useful when a later review finds the report was
 * spam after all).
 *
 * Returns 404 on unknown id — admins don't need IDOR defence but
 * a missing-id 404 is cleaner than a silent no-op.
 *
 * Installed by prompt [IV.18.11.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { ScamReport } from '../domain/scam-report.entity';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

export interface VerifyScamReportCommand {
  readonly id: string;
  readonly verified: boolean;
}

@Injectable()
export class VerifyScamReportUseCase {
  constructor(@Inject(SCAM_REPORT_REPOSITORY) private readonly repo: ScamReportRepository) {}

  async execute(cmd: VerifyScamReportCommand): Promise<ScamReport> {
    const updated = await this.repo.setVerified(cmd.id, cmd.verified);
    if (!updated) {
      throw new NotFoundError(
        `Scam report not found: ${cmd.id}`,
        { scamReportId: cmd.id },
        'SCAM_REPORT_NOT_FOUND',
      );
    }
    return updated;
  }
}
