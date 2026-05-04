/**
 * Admin media hard-delete. Used for takedowns of abusive content
 * (CSAM, doxxing, etc.). No owner scope.
 *
 * Cascades:
 *   - `MediaAsset.tripId` is `SetNull` on delete → attached trip
 *     survives, just loses this media reference.
 *   - `MediaAsset.memoryBookId` is `SetNull` on delete → attached
 *     memory book survives, just loses this media reference.
 *
 * The S3 object behind `s3KeyRaw` is NOT cleaned up here.
 * Orphan-object sweep is a future cron concern. The trade-off:
 * an immediate-effect takedown verb at the cost of some S3
 * garbage that the sweep eventually picks up.
 *
 * 404 on missing row.
 *
 * V.UX.36 — every successful delete writes one row to
 * AdminAuditLog with `{action:'delete_media'}`.
 *
 * Installed by prompt [IV.18.18.4]; audit log added in [V.UX.36].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  type AdminAuditLogRepository,
} from '../../admin/application/ports/admin-audit-log.repository';
import { recordAdminAction } from '../../admin/application/record-admin-action.helper';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

export interface AdminDeleteMediaCommand {
  readonly actorId: string;
  readonly mediaId: string;
}

@Injectable()
export class AdminDeleteMediaUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: AdminDeleteMediaCommand): Promise<void> {
    const ok = await this.media.adminDelete(cmd.mediaId);
    if (!ok) {
      throw new NotFoundError(
        `Media not found: ${cmd.mediaId}`,
        { mediaId: cmd.mediaId },
        'MEDIA_NOT_FOUND',
      );
    }
    await recordAdminAction(this.audit, {
      actorId: cmd.actorId,
      targetType: 'media',
      targetId: cmd.mediaId,
      action: 'delete_media',
    });
  }
}
