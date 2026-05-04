-- V.UX.37 — read-only compliance role.
--
-- Promoted by admin via tooling (future). Compliance role gates
-- /api/v1/compliance/* surfaces — retention dashboard + takedown
-- log + CSV export. Strictly weaker than admin: read-only.

ALTER TYPE "UserRole" ADD VALUE 'compliance';
