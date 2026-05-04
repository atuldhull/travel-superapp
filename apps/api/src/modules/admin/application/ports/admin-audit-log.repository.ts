/**
 * V.UX.36 — admin audit log repository port. Append-only writes
 * + filterable read-only list. There is no `update` or `delete` —
 * audit rows outlive the actions they describe.
 */
import type { AdminAuditLog } from '../../domain/admin-audit-log.entity';

export const ADMIN_AUDIT_LOG_REPOSITORY = Symbol('ADMIN_AUDIT_LOG_REPOSITORY');

export interface RecordAdminAuditLogInput {
  readonly actorId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context?: Record<string, unknown> | null;
}

export interface ListAdminAuditLogQuery {
  readonly actorId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  /** Single-action filter. Mutually exclusive with `actions`. */
  readonly action?: string;
  /** V.UX.37 — multi-action filter (IN). Used by the compliance
   *  takedown report to scope to delete_* / dismiss_* / archive_*
   *  actions in one round trip. */
  readonly actions?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAdminAuditLogResult {
  readonly rows: readonly AdminAuditLog[];
  readonly total: number;
}

export interface AdminAuditLogRepository {
  record(input: RecordAdminAuditLogInput): Promise<AdminAuditLog>;
  list(query: ListAdminAuditLogQuery): Promise<ListAdminAuditLogResult>;
}
