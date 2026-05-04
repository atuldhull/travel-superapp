/**
 * V.UX.36 — small helper that other modules' admin use-cases call
 * after their action succeeds. Wraps `repo.record()` in a try/catch
 * so an audit-write failure NEVER blocks a successful admin action;
 * the failure is logged at warn level and an SRE alarm should pick
 * it up. The audit trail is best-effort by design — wrapping action
 * + audit in a Prisma transaction would require threading $tx
 * through every admin repo, which is a much bigger refactor.
 */
import { createLogger } from '@app/logger';
import type {
  AdminAuditLogRepository,
  RecordAdminAuditLogInput,
} from './ports/admin-audit-log.repository';

const log = createLogger('admin-audit-log');

export async function recordAdminAction(
  repo: AdminAuditLogRepository,
  input: RecordAdminAuditLogInput,
): Promise<void> {
  try {
    await repo.record(input);
  } catch (err) {
    log.warn(
      { err, action: input.action, targetType: input.targetType, targetId: input.targetId },
      'failed to record admin audit log row — action succeeded but audit row was not persisted',
    );
  }
}
