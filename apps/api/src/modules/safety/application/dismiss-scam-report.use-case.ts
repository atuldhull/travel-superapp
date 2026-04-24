/**
 * Admin dismisses a ScamReport — hard delete. Used for spam,
 * duplicates, or reports that fail review.
 *
 * Hard delete instead of soft because there's no legitimate
 * "undismiss" flow (a re-reporter would just submit fresh) and
 * the schema has no `dismissedAt` column. Reporter is NOT
 * notified — a future `Safety.ScamReportDismissed` event can wire
 * that when the notification fan-out is more developed.
 *
 * 404 on unknown id.
 *
 * Installed by prompt [IV.18.11.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

@Injectable()
export class DismissScamReportUseCase {
  constructor(@Inject(SCAM_REPORT_REPOSITORY) private readonly repo: ScamReportRepository) {}

  async execute(id: string): Promise<void> {
    const removed = await this.repo.deleteById(id);
    if (!removed) {
      throw new NotFoundError(
        `Scam report not found: ${id}`,
        { scamReportId: id },
        'SCAM_REPORT_NOT_FOUND',
      );
    }
  }
}
