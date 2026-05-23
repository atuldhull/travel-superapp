/**
 * Admin trip hard-delete. Used for takedowns of clearly-abusive
 * content. No owner scope; cascades through Prisma `onDelete`
 * settings to itinerary days + items + votes + expenses + reviews
 * + media (everything user-trip-scoped).
 *
 * 404 on missing row. Idempotent: a second delete on the same id
 * returns 404 — the row is already gone, which is the explicit
 * "your prior call succeeded" signal an admin caller should see.
 *
 * V.UX.36 — every successful delete writes one row to
 * AdminAuditLog with `{action:'delete_trip'}`.
 *
 * Installed by prompt [IV.18.18.3]; audit log added in [V.UX.36].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  recordAdminAction,
  type AdminAuditLogRepository,
} from '../../admin';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface AdminDeleteTripCommand {
  readonly actorId: string;
  readonly tripId: string;
}

@Injectable()
export class AdminDeleteTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: AdminDeleteTripCommand): Promise<void> {
    const ok = await this.trips.adminDelete(cmd.tripId);
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
      action: 'delete_trip',
    });
  }
}
