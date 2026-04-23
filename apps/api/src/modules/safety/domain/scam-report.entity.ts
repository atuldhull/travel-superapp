/**
 * Plain-data domain `ScamReport`. Mirrors the Prisma row minus the
 * PostGIS `coordinates` column (Unsupported; read via `GeoQueries`
 * when needed). The search path returns `ScamReportWithDistance`
 * including the geodesic distance from the query point.
 *
 * `category` is a free-form string so new scam types (e.g.,
 * `crypto-atm-scam`) don't need a schema migration. A follow-up
 * slice can tighten to an enum once the catalog stabilizes.
 *
 * Installed by prompt [IV.18.11.1].
 */
export type ScamSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ScamReport {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  /** Moderator-verified flag. `false` on user submission; flipped
   *  by an admin moderation flow (not in this slice). */
  readonly verified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ScamReportWithDistance extends ScamReport {
  readonly distanceMeters: number;
}
