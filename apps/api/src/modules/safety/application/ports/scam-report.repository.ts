/**
 * Port for ScamReport persistence + geospatial search. Adapter
 * delegates to `GeoQueries` (CLAUDE rule 11 — PostGIS columns
 * never flow through Prisma's typed paths).
 *
 * `report` is the write-path; `findNearby` is the read-path.
 * Moderation (flip `verified`, delete spam) is a follow-up slice.
 *
 * Installed by prompt [IV.18.11.1].
 */
import type {
  ScamReport,
  ScamReportWithDistance,
  ScamSeverity,
} from '../../domain/scam-report.entity';

export interface ReportScamInput {
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly lat: number;
  readonly lng: number;
  readonly description: string;
  readonly evidenceUrls?: readonly string[];
}

export interface FindNearbyScamsInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly filters?: {
    readonly category?: string;
    readonly minSeverity?: ScamSeverity;
    /**
     * When present, restrict results to rows matching the flag.
     * `true` = admin-verified only (public "trusted reports"
     * view); absent = return both. `false` is accepted but not
     * exposed on the public HTTP surface in v1. [IV.18.11.6]
     */
    readonly verified?: boolean;
  };
}

export interface ScamReportRepository {
  report(input: ReportScamInput): Promise<ScamReport>;
  findNearby(input: FindNearbyScamsInput): Promise<readonly ScamReportWithDistance[]>;
  /**
   * Admin-facing listing. Defaults to `verified = false` for the
   * moderation queue; pass `{ verified: true }` to list already-
   * verified rows for audit. Most-recent-first.
   */
  listForModeration(input: ListForModerationInput): Promise<readonly ScamReport[]>;
  /**
   * Total count of moderation rows matching the same filter as
   * `listForModeration` — the list is capped (≤200) but the admin SLA
   * backlog tile needs the true count.
   */
  countForModeration(verified?: boolean): Promise<number>;
  /**
   * Flip `verified` to the target value. Returns the updated row,
   * or `null` if the id is unknown. Idempotent — re-setting to the
   * same value still returns the row (Postgres update-count = 1).
   */
  setVerified(id: string, verified: boolean): Promise<ScamReport | null>;
  /**
   * Admin dismiss path — deletes the row outright. Returns `true`
   * iff a row was actually removed. Reporter is NOT notified; a
   * future slice can wire a `Safety.ScamReportDismissed` event for
   * that.
   */
  deleteById(id: string): Promise<boolean>;
}

export interface ListForModerationInput {
  readonly verified?: boolean;
  readonly limit: number;
}

export const SCAM_REPORT_REPOSITORY = Symbol('ScamReportRepository');
