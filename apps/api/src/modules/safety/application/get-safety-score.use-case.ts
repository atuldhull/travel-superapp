/**
 * Composite safety score for a coordinate + radius. Aggregates the
 * Safety module's two public primitives (crime incidents + scam
 * reports) into a single 0–100 score plus a letter grade + an
 * incident breakdown the UI can render.
 *
 * **SOS events are intentionally excluded.** SOS is a personal
 * distress signal; exposing even aggregated counts near a coord
 * would leak privacy-adjacent information about other users'
 * emergencies. Safety score is a public metric derived from
 * public data sources (official crime feeds + crowd-sourced scam
 * reports), not personal-help-request state.
 *
 * Formula (v1 — deliberately simple + auditable):
 *   penalty = Σ crime_severity_weight × CRIME_MULTIPLIER +
 *             Σ scam_severity_weight × SCAM_MULTIPLIER
 *   score = max(0, 100 - penalty)
 *   grade = A (90–100) · B (75–89) · C (60–74) · D (40–59) · F (<40)
 *
 * Weights:
 *   CRIME_MULTIPLIER = 10      — government/authoritative sources
 *   SCAM_MULTIPLIER  = 5       — crowd-sourced, lower confidence
 *   severity → rank: low=1, medium=2, high=3, critical=4
 *
 * So a single critical crime = 40 pts (C territory); one low scam
 * = 5 pts (mild ding). Designed to respect hierarchy: weightier
 * categories dominate mild ones, but lots of mild reports still
 * add up.
 *
 * This is NOT a production-grade safety model — a future slice can
 * swap in time-of-day weighting, demographic normalisation, or
 * ML-derived scoring without changing the port shape or the HTTP
 * contract (score + grade + breakdown).
 *
 * Installed by prompt [IV.18.11.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import type { CrimeIncidentWithDistance, ScamSeverity } from '../domain/crime-incident.entity';
import type { ScamReportWithDistance } from '../domain/scam-report.entity';
import { FindNearbyCrimesUseCase } from './find-nearby-crimes.use-case';
import { FindNearbyScamsUseCase } from './find-nearby-scams.use-case';

const MAX_RADIUS_KM = 10;
const DEFAULT_RADIUS_KM = 2;
// Crime layer rolls off old data — we look at the last year.
const CRIME_WINDOW_DAYS = 365;
const CRIME_MULTIPLIER = 10;
const SCAM_MULTIPLIER = 5;

export type SafetyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GetSafetyScoreCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm?: number;
}

export interface SafetyBreakdown {
  readonly crimes: number;
  readonly scams: number;
  readonly byCrimeSeverity: Readonly<Record<ScamSeverity, number>>;
  readonly byScamSeverity: Readonly<Record<ScamSeverity, number>>;
}

export interface SafetyScore {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly score: number;
  readonly grade: SafetyGrade;
  readonly breakdown: SafetyBreakdown;
  readonly computedAt: Date;
}

@Injectable()
export class GetSafetyScoreUseCase {
  constructor(
    @Inject(FindNearbyCrimesUseCase) private readonly findCrimes: FindNearbyCrimesUseCase,
    @Inject(FindNearbyScamsUseCase) private readonly findScams: FindNearbyScamsUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: GetSafetyScoreCommand): Promise<SafetyScore> {
    if (!Number.isFinite(cmd.lat) || cmd.lat < -90 || cmd.lat > 90) {
      throw new ValidationError(
        'Latitude out of range',
        { lat: ['must be between -90 and 90'] },
        { lat: cmd.lat },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.lng) || cmd.lng < -180 || cmd.lng > 180) {
      throw new ValidationError(
        'Longitude out of range',
        { lng: ['must be between -180 and 180'] },
        { lng: cmd.lng },
        'INVALID_COORDINATES',
      );
    }
    const radiusKm = cmd.radiusKm ?? DEFAULT_RADIUS_KM;
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be positive',
        { radiusKm: ['must be > 0'] },
        { radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (radiusKm > MAX_RADIUS_KM) {
      throw new ValidationError(
        `Radius too large (max ${MAX_RADIUS_KM}km)`,
        { radiusKm: [`must be ≤ ${MAX_RADIUS_KM}`] },
        { radiusKm, max: MAX_RADIUS_KM },
        'INVALID_RADIUS',
      );
    }

    // Parallel fan-out to the two primitives. Scam reports aren't
    // time-windowed (they're crowd-sourced recency-agnostic
    // observations); crime data is, per CRIME_WINDOW_DAYS.
    const [crimes, scams] = await Promise.all([
      this.findCrimes.execute({
        lat: cmd.lat,
        lng: cmd.lng,
        radiusKm,
        sinceDays: CRIME_WINDOW_DAYS,
        limit: 200,
      }),
      this.findScams.execute({
        lat: cmd.lat,
        lng: cmd.lng,
        radiusKm,
        limit: 200,
      }),
    ]);

    const breakdown = summarize(crimes, scams);
    const penalty =
      sumRanked(breakdown.byCrimeSeverity) * CRIME_MULTIPLIER +
      sumRanked(breakdown.byScamSeverity) * SCAM_MULTIPLIER;
    const score = Math.max(0, 100 - penalty);

    return {
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm,
      score,
      grade: grade(score),
      breakdown,
      computedAt: this.clock.now(),
    };
  }
}

function grade(score: number): SafetyGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function severityRank(s: ScamSeverity): number {
  switch (s) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
  }
}

function sumRanked(counts: Readonly<Record<ScamSeverity, number>>): number {
  return (
    counts.low * severityRank('low') +
    counts.medium * severityRank('medium') +
    counts.high * severityRank('high') +
    counts.critical * severityRank('critical')
  );
}

function emptyBucket(): Record<ScamSeverity, number> {
  return { low: 0, medium: 0, high: 0, critical: 0 };
}

function summarize(
  crimes: readonly CrimeIncidentWithDistance[],
  scams: readonly ScamReportWithDistance[],
): SafetyBreakdown {
  const byCrimeSeverity = emptyBucket();
  for (const c of crimes) byCrimeSeverity[c.severity]++;
  const byScamSeverity = emptyBucket();
  for (const s of scams) byScamSeverity[s.severity]++;
  return {
    crimes: crimes.length,
    scams: scams.length,
    byCrimeSeverity,
    byScamSeverity,
  };
}
