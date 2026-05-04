-- V.UX.38 — site reliability engineer role.
--
-- Read-only access to /ops/* dashboard surfaces (health probes,
-- runbook index, force-purge button — no other destructive verbs).
-- Strictly weaker than admin. Promoted by admin via tooling.

ALTER TYPE "UserRole" ADD VALUE 'sre';
