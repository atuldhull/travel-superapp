-- V.UX.36 — append-only admin action log.
--
-- Every admin write (ban/unban/verify_scam/dismiss_scam/resolve_sos/
-- delete_media/delete_trip/archive_trip) writes one row here. The
-- /admin/audit-logs surface is read-only by design — there is no
-- "edit audit row" or "delete audit row" verb.
--
-- targetType is a free-form string so new admin verbs land without
-- a schema migration. context (jsonb) carries small per-action
-- payload (e.g. {reason} for ban; {note} for resolve_sos;
-- {verified} for verify_scam). Keep it under ~1 KB.
--
-- actorId is FK to User; ON DELETE SET NULL so the audit trail
-- outlives the actor (action history preserved) but the actor
-- reference anonymizes when the admin self-deletes via the GDPR
-- erasure path.

CREATE TABLE "AdminAuditLog" (
  "id"         TEXT          NOT NULL,
  "actorId"    TEXT,
  "targetType" TEXT          NOT NULL,
  "targetId"   TEXT          NOT NULL,
  "action"     TEXT          NOT NULL,
  "context"    JSONB,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx"
  ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx"
  ON "AdminAuditLog"("targetType", "targetId", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "AdminAuditLog_createdAt_idx"
  ON "AdminAuditLog"("createdAt");
ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
