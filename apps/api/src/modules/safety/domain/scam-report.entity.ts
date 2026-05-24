/**
 * `ScamReport` domain entity. Mirrors the Prisma row minus the
 * PostGIS `coordinates` column (Unsupported; read via `GeoQueries`).
 * The search path returns `ScamReportWithDistance` including the
 * geodesic distance from the query point.
 *
 * `category` is a free-form string so new scam types (e.g.,
 * `crypto-atm-scam`) don't need a schema migration. The MAX length
 * keeps the column sane; a follow-up slice can tighten to an enum
 * once the catalog stabilises.
 *
 * DDD refactor by [G4.2]: 5 invariants moved off `ReportScamUseCase`:
 *   S1 reporterId non-empty
 *   S2 category non-empty + ≤ 60 chars (after trim)
 *   S3 severity ∈ {low, medium, high, critical}
 *   S4 description ≤ 2000 chars (non-empty)
 *   S5 evidenceUrls ≤ 5 entries, each non-empty + ≤ 500 chars
 *
 * lat/lng range checks stay in the use-case — they're a geo concern
 * and the entity intentionally has no coordinates field.
 *
 * Installed by prompt [IV.18.11.1]; entity-ized by [G4.2].
 */
import { ValidationError } from '@app/errors';

export type ScamSeverity = 'low' | 'medium' | 'high' | 'critical';
export const SCAM_SEVERITIES: readonly ScamSeverity[] = ['low', 'medium', 'high', 'critical'];

export const SCAM_MAX_CATEGORY_LENGTH = 60;
export const SCAM_MAX_DESCRIPTION_LENGTH = 2000;
export const SCAM_MAX_EVIDENCE_URLS = 5;
export const SCAM_MAX_URL_LENGTH = 500;

/** Input shape for `ScamReport.create()` — the validated payload to
 *  pass to `ScamReportRepository.report()` (lat/lng are added by the
 *  use-case once the geo gate passes). */
export interface CreateScamReportInput {
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly evidenceUrls?: readonly string[];
}

/** Row shape returned by the Prisma adapter (no coordinates — read via
 *  GeoQueries when distance is wanted). */
export interface ScamReportPersistenceRow {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly verified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class ScamReport {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  /** Moderator-verified flag. `false` on user submission; flipped
   *  by an admin moderation flow. */
  readonly verified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: ScamReportPersistenceRow) {
    this.id = row.id;
    this.reporterId = row.reporterId;
    this.category = row.category;
    this.severity = row.severity;
    this.description = row.description;
    this.evidenceUrls = row.evidenceUrls;
    this.verified = row.verified;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a normalised CreateScamReportInput ready for
   * `ScamReportRepository.report()`. Throws `ValidationError` on any
   * invariant break.
   */
  static create(input: CreateScamReportInput): CreateScamReportInput {
    if (typeof input.reporterId !== 'string' || input.reporterId.length === 0) {
      throw new ValidationError(
        'reporterId must be a non-empty string',
        { reporterId: ['must be non-empty'] },
        {},
        'INVALID_SCAM_REPORT',
      );
    }
    const category = input.category.trim();
    if (category.length === 0 || category.length > SCAM_MAX_CATEGORY_LENGTH) {
      throw new ValidationError(
        `category must be 1..${SCAM_MAX_CATEGORY_LENGTH} chars (after trim)`,
        { category: ['out of range'] },
        { length: category.length },
        'INVALID_SCAM_REPORT',
      );
    }
    if (!SCAM_SEVERITIES.includes(input.severity)) {
      throw new ValidationError(
        `severity must be one of ${SCAM_SEVERITIES.join(' | ')}`,
        { severity: [`unknown: ${input.severity}`] },
        { severity: input.severity },
        'INVALID_SCAM_REPORT',
      );
    }
    const description = input.description.trim();
    if (description.length === 0 || description.length > SCAM_MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `description must be 1..${SCAM_MAX_DESCRIPTION_LENGTH} chars (after trim)`,
        { description: ['out of range'] },
        { length: description.length },
        'INVALID_SCAM_REPORT',
      );
    }
    const evidenceUrls = input.evidenceUrls ?? [];
    if (evidenceUrls.length > SCAM_MAX_EVIDENCE_URLS) {
      throw new ValidationError(
        `evidenceUrls must have ≤ ${SCAM_MAX_EVIDENCE_URLS} entries`,
        { evidenceUrls: ['too many'] },
        { count: evidenceUrls.length },
        'INVALID_SCAM_REPORT',
      );
    }
    for (const url of evidenceUrls) {
      if (typeof url !== 'string' || url.length === 0 || url.length > SCAM_MAX_URL_LENGTH) {
        throw new ValidationError(
          `each evidence URL must be 1..${SCAM_MAX_URL_LENGTH} chars`,
          { evidenceUrls: ['entry out of range'] },
          { url, length: url?.length ?? 0 },
          'INVALID_SCAM_REPORT',
        );
      }
    }
    const out: CreateScamReportInput = {
      reporterId: input.reporterId,
      category,
      severity: input.severity,
      description,
      ...(input.evidenceUrls ? { evidenceUrls: input.evidenceUrls } : {}),
    };
    return out;
  }

  /** Wrap a persisted row in a `ScamReport` instance. */
  static fromPersistence(row: ScamReportPersistenceRow): ScamReport {
    return new ScamReport(row);
  }
}

export interface ScamReportWithDistance {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly verified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly distanceMeters: number;
}
