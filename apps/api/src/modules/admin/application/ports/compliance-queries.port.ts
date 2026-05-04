/**
 * V.UX.37 — read-only port aggregating retention + lifecycle counts
 * across the user/trip/sos/scam-report/notification surfaces.
 *
 * The shape mirrors the GDPR/DPDP retention dashboard's needs:
 *   - softDeleted / scheduledForPurge → caller-self deletions awaiting
 *     the 7-day retention sweep.
 *   - banned → admin-driven moderation (separate from deletion).
 *   - oldest soft-delete + days-until-purge for the OLDEST candidate
 *     (so the dashboard can warn when the sweep is about to hit a
 *     particularly old account).
 *
 * Adapter goes through PrismaService directly — no PostGIS required.
 */
export const COMPLIANCE_QUERIES_PORT = Symbol('COMPLIANCE_QUERIES_PORT');

export interface RetentionStats {
  readonly retentionDays: number;
  readonly users: {
    readonly active: number;
    readonly softDeleted: number;
    readonly scheduledForPurge: number;
    readonly banned: number;
    readonly oldestSoftDeleteAt: string | null;
    readonly daysUntilPurgeForOldest: number | null;
  };
  readonly trips: {
    readonly total: number;
    readonly archived: number;
  };
  readonly safety: {
    readonly activeSos: number;
    readonly resolvedSos: number;
    readonly pendingScamReports: number;
    readonly verifiedScamReports: number;
  };
  readonly inbox: {
    readonly notifications: number;
    readonly archivedNotifications: number;
  };
  readonly appeals: {
    readonly pending: number;
    readonly approved: number;
    readonly rejected: number;
  };
  readonly computedAt: string;
}

export interface ComplianceQueries {
  getRetentionStats(retentionDays: number, now: Date): Promise<RetentionStats>;
}
