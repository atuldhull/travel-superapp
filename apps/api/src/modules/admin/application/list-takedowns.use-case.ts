/**
 * V.UX.37 — compliance takedown report. Filters the AdminAuditLog
 * to actions that affect user-generated content:
 *
 *   delete_media   · admin removed a user's media asset
 *   delete_trip    · admin hard-deleted a user's trip
 *   archive_trip   · admin soft-archived a user's trip
 *   dismiss_scam   · admin removed a user's scam report
 *
 * Ban/unban + verify_scam + resolve_sos are NOT user-content-takedown
 * verbs — they live on the V.UX.36 audit page proper.
 *
 * Newest-first; offset pagination clamped to limit ∈ [1, 500] so
 * the CSV export can pull a fuller page.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  type AdminAuditLogRepository,
  type ListAdminAuditLogResult,
} from './ports/admin-audit-log.repository';

export const TAKEDOWN_ACTIONS: readonly string[] = [
  'delete_media',
  'delete_trip',
  'archive_trip',
  'dismiss_scam',
] as const;

export interface ListTakedownsQuery {
  readonly limit?: number;
  readonly offset?: number;
  /** Optional override — defaults to TAKEDOWN_ACTIONS. */
  readonly actions?: readonly string[];
}

@Injectable()
export class ListTakedownsUseCase {
  constructor(
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY)
    private readonly repo: AdminAuditLogRepository,
  ) {}

  async execute(query: ListTakedownsQuery = {}): Promise<ListAdminAuditLogResult> {
    const limit = query.limit !== undefined ? Math.max(1, Math.min(500, query.limit)) : 100;
    const offset = query.offset !== undefined ? Math.max(0, query.offset) : 0;
    const actions = query.actions && query.actions.length > 0 ? query.actions : TAKEDOWN_ACTIONS;
    return this.repo.list({ actions, limit, offset });
  }
}
