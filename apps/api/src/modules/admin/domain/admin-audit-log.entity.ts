/**
 * V.UX.36 — admin audit log domain entity. Append-only.
 *
 * `targetType` is intentionally a string (not enum) so new admin
 * verbs can land without schema migration. Same posture for
 * `action`. `context` is a small per-action JSON payload.
 */
export interface AdminAuditLog {
  readonly id: string;
  /** Null when the actor User row was deleted (FK SetNull). The
   *  audit row's `action` + `context` survive — only the actor
   *  reference is anonymized. */
  readonly actorId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context: Record<string, unknown> | null;
  readonly createdAt: Date;
}
