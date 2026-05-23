/**
 * Admin trip archive — soft moderation. Flips `status = 'archived'`
 * on any trip; no owner scope. The trip stays in the DB; the owner
 * can unarchive via the existing PATCH /trips/:id flow if/when
 * appropriate.
 *
 * 404 path: trip row is missing.
 *
 * V.UX.36 — every successful archive writes one row to
 * AdminAuditLog with `{action:'archive_trip'}`.
 *
 * Installed by prompt [IV.18.18.3]; audit log added in [V.UX.36].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { ADMIN_AUDIT_LOG_REPOSITORY, type AdminAuditLogRepository } from '../../admin';
import { recordAdminAction } from '../../admin/application/record-admin-action.helper';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface AdminArchiveTripCommand {
  readonly actorId: string;
  readonly tripId: string;
}

@Injectable()
export class AdminArchiveTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: AdminArchiveTripCommand): Promise<void> {
    const ok = await this.trips.adminArchive(cmd.tripId);
    if (!ok) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }
    await recordAdminAction(this.audit, {
      actorId: cmd.actorId,
      targetType: 'trip',
      targetId: cmd.tripId,
      action: 'archive_trip',
    });
  }
}
