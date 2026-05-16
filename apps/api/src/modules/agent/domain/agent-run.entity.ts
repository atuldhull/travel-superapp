/**
 * POST.2A.1 — the agent's supervised lifetime over one trip.
 *
 * A run is created when a trip's agent watch starts and is closed
 * when the trip ends (Seam 1, POST.2C.1, drafts a Memory Book at
 * close). Plain readonly interface per the project's domain
 * convention — no methods, no factory here; invariants are enforced
 * by application use-cases.
 *
 * Installed by prompt [POST.2A.1].
 */

/** `watching` while the trip is live; `closed` once it ends. */
export type AgentRunStatus = 'watching' | 'closed';

export interface AgentRun {
  readonly id: string;
  readonly tripId: string;
  readonly status: AgentRunStatus;
  /**
   * Monotonic counter bumped each time a re-plan proposal is
   * accepted. Starts at 1 (the original 1.0-generated plan).
   */
  readonly planVersion: number;
  readonly createdAt: Date;
}
