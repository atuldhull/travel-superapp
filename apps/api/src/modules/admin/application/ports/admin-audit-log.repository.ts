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
  readonly action?: string;
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
