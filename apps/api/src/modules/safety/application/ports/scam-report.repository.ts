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
  };
}

export interface ScamReportRepository {
  report(input: ReportScamInput): Promise<ScamReport>;
  findNearby(input: FindNearbyScamsInput): Promise<readonly ScamReportWithDistance[]>;
}

export const SCAM_REPORT_REPOSITORY = Symbol('ScamReportRepository');
