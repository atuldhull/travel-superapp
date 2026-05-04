/**
 * V.UX.36 — read-only admin audit log lister with filters.
 *
 *   - actor: scope to actions performed by one admin (their userId).
 *   - targetType + targetId: scope to actions performed against one
 *     entity (e.g. all actions taken against a specific user).
 *   - action: scope to one verb (e.g. all 'ban' actions).
 *
 * Limit clamped to [1, 200], offset to [0, ∞). Newest-first.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  type AdminAuditLogRepository,
  type ListAdminAuditLogResult,
} from './ports/admin-audit-log.repository';

export interface AdminListAuditLogsQuery {
  readonly actorId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly action?: string;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AdminListAuditLogsUseCase {
  constructor(
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY)
    private readonly repo: AdminAuditLogRepository,
  ) {}

  async execute(query: AdminListAuditLogsQuery): Promise<ListAdminAuditLogResult> {
    const limit = query.limit !== undefined ? Math.max(1, Math.min(200, query.limit)) : 50;
    const offset = query.offset !== undefined ? Math.max(0, query.offset) : 0;
    return this.repo.list({
      ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
      ...(query.targetType !== undefined ? { targetType: query.targetType } : {}),
      ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
      ...(query.action !== undefined ? { action: query.action } : {}),
      limit,
      offset,
    });
  }
}
