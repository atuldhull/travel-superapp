/**
 * POST.2A.1 — what an agent run subscribes to for one trip.
 *
 * A watch names the signal kinds the deterministic loop polls
 * (POST.2A.3) and the materiality thresholds below which a change
 * is logged but ignored. Readonly interface; one active watch per
 * trip is a domain invariant enforced in the start-watch use-case
 * (POST.2A.2).
 *
 * Installed by prompt [POST.2A.1].
 */

/** Signal kinds the agent can subscribe a trip to. */
// Phase 3 (G5) — `deadline` is the trip-start-approaching reminder
// signal. Pure (no network): a `DeadlineSignalAdapter` derives
// `daysUntilStart` from the optional `tripStartsOnIso` on the
// query. Subscribing a watch to this kind stays opt-in — nothing
// new fires by default (LAW 2).
//
// Phase 6 (I4) — `safety_proximity` is the proactive safety signal:
// a pure `SafetyProximitySignalAdapter` evaluates recent verified
// scam reports near the trip center (passed on the query as
// `nearbyScamReports`, NOT PII — aggregate reports near coordinates).
// Like `deadline` it is addressable but does NOT auto-fire in the
// live watch loop, which builds queries with only `{kind,lat,lng}`.
// Subscribing a watch to this kind is opt-in (LAW 2).
export type SignalKind = 'weather' | 'flight' | 'geofence' | 'deadline' | 'safety_proximity';

export interface TripWatch {
  readonly id: string;
  readonly tripId: string;
  readonly agentRunId: string;
  readonly subscribedSignals: readonly SignalKind[];
  /**
   * Materiality thresholds keyed by signal kind (e.g.
   * `{ weather: 0.7 }` = re-plan only when rain probability ≥ 0.7).
   * A decline raises the relevant threshold (POST.2A.4).
   */
  readonly thresholds: Readonly<Record<string, number>>;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
