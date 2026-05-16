/**
 * POST.2A.1 — an immutable proposed change to a trip's itinerary.
 *
 * The deterministic loop (POST.2A.3) emits PlanDiffs; propose-replan
 * (POST.2A.4) attaches a human-readable reason and a notification.
 * A diff is a proposal only — it never mutates a trip until the
 * user confirms (LAW 2: the agent never acts autonomously).
 *
 * Installed by prompt [POST.2A.1].
 */

/** Add a new stop, move an existing one, or drop one. */
export type PlanDiffOp = 'add' | 'move' | 'drop';

export interface PlanDiff {
  readonly op: PlanDiffOp;
  /** Itinerary stop the change targets. */
  readonly stopId: string;
  /** One-line, user-facing justification (e.g. "rain ≥ 80% Tue"). */
  readonly reason: string;
}
