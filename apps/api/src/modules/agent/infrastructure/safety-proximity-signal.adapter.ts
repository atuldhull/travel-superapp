/**
 * Phase 6 (I4) — Proactive safety-proximity signal.
 *
 * Pure (no network, no DB): given the optional `nearbyScamReports`
 * on the query, reports `changed: true` when there is at least one
 * VERIFIED scam report within `PROXIMITY_RADIUS_KM` of the trip
 * centre observed within the last `RECENCY_WINDOW_DAYS`.
 *
 * Mirrors the `DeadlineSignalAdapter` (G5):
 *   • No `nearbyScamReports` → `{ changed: false, reason: 'no-reports' }`.
 *     The signal is opt-in via the query, not via env.
 *   • Reports present but none qualify → `{ changed: false }` with
 *     the evaluated counts so the loop can log materiality.
 *   • A qualifying report → `{ changed: true, ... }`. The evaluator
 *     decides whether to surface a re-plan / advisory.
 *
 * LAW 2: `nearbyScamReports` is aggregate, non-PII data (distance +
 * verified flag + recency). No reporter identity, no exact address.
 * Subscribing a watch to `'safety_proximity'` stays opt-in — the
 * live watch loop builds queries with only `{kind,lat,lng}`, so
 * nothing new fires by default. This adapter just makes the kind
 * addressable from the CompositeSignalSource.
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import type {
  NearbyScamReport,
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';

/** Reports farther than this from the trip centre are out of scope. */
const PROXIMITY_RADIUS_KM = 5;
/** Reports older than this are stale — a months-old scam isn't news. */
const RECENCY_WINDOW_DAYS = 14;

@Injectable()
export class SafetyProximitySignalAdapter implements SignalSource {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    const observedAt = this.clock.now();
    const reports = query.nearbyScamReports;
    if (!reports || reports.length === 0) {
      return {
        kind: 'safety_proximity',
        observedAt,
        data: { changed: false, reason: 'no-reports' },
      };
    }

    // A report qualifies when it is verified, close enough, and
    // recent enough. Negative / non-finite distances or ages are
    // treated as not-qualifying rather than throwing — the adapter
    // must never crash the watch loop.
    const qualifying = reports.filter((r) => isQualifying(r));
    const nearestKm = reports.reduce<number | null>((min, r) => {
      if (!Number.isFinite(r.distanceKm)) return min;
      return min === null ? r.distanceKm : Math.min(min, r.distanceKm);
    }, null);

    if (qualifying.length === 0) {
      return {
        kind: 'safety_proximity',
        observedAt,
        data: {
          changed: false,
          reportCount: reports.length,
          qualifyingCount: 0,
          radiusKm: PROXIMITY_RADIUS_KM,
          windowDays: RECENCY_WINDOW_DAYS,
          ...(nearestKm !== null ? { nearestKm } : {}),
        },
      };
    }

    const nearestQualifyingKm = qualifying.reduce(
      (min, r) => Math.min(min, r.distanceKm),
      qualifying[0]!.distanceKm,
    );
    return {
      kind: 'safety_proximity',
      observedAt,
      data: {
        changed: true,
        reportCount: reports.length,
        qualifyingCount: qualifying.length,
        nearestKm: nearestQualifyingKm,
        radiusKm: PROXIMITY_RADIUS_KM,
        windowDays: RECENCY_WINDOW_DAYS,
      },
    };
  }
}

function isQualifying(r: NearbyScamReport): boolean {
  if (!r.verified) return false;
  if (!Number.isFinite(r.distanceKm) || r.distanceKm < 0) return false;
  if (!Number.isFinite(r.observedDaysAgo) || r.observedDaysAgo < 0) return false;
  return r.distanceKm <= PROXIMITY_RADIUS_KM && r.observedDaysAgo <= RECENCY_WINDOW_DAYS;
}
