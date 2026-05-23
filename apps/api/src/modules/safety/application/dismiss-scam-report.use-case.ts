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
 * V.UX.36 — every successful dismiss writes one row to
 * AdminAuditLog with `{action:'dismiss_scam'}`.
 *
 * Installed by prompt [IV.18.11.5]; audit log added in [V.UX.36].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  recordAdminAction,
  type AdminAuditLogRepository,
} from '../../admin';
import { SCAM_REPORT_REPOSITORY, type ScamReportRepository } from './ports/scam-report.repository';

export interface DismissScamReportCommand {
  readonly actorId: string;
  readonly id: string;
}

@Injectable()
export class DismissScamReportUseCase {
  constructor(
    @Inject(SCAM_REPORT_REPOSITORY) private readonly repo: ScamReportRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: DismissScamReportCommand): Promise<void> {
    const removed = await this.repo.deleteById(cmd.id);
    if (!removed) {
      throw new NotFoundError(
        `Scam report not found: ${cmd.id}`,
        { scamReportId: cmd.id },
        'SCAM_REPORT_NOT_FOUND',
      );
    }
    await recordAdminAction(this.audit, {
      actorId: cmd.actorId,
      targetType: 'scam_report',
      targetId: cmd.id,
      action: 'dismiss_scam',
    });
  }
}
