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
export type SignalKind = 'weather' | 'flight' | 'geofence';

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
}
