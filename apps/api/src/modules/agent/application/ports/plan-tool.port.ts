/**
 * POST.2A.1/2A.4 — port the agent uses to draft a re-plan.
 *
 * Bound to an adapter that delegates to the EXISTING 1.0 trip
 * planner (TRIP_PLANNER_PORT / generatePlan) — no new LLM plumbing.
 * The agent passes the trip context IN (it does not fetch it; the
 * scheduler↔trip glue that supplies real context is the deferred
 * integration seam, same as POST.2A.3's coord resolution).
 *
 * LAW 2: the planner only ever receives trip planning fields — never
 * anything money-related. Installed by [POST.2A.1]; finalised [POST.2A.4].
 */

/** Minimal trip context the planner needs (mirrors TripPlannerRequest). */
export interface PlanTripContext {
  readonly title: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly startsOn: Date | null;
  readonly endsOn: Date | null;
}

export interface DraftReplanInput {
  readonly trip: PlanTripContext;
  /** Why the loop thinks a re-plan is warranted (user-facing). */
  readonly reason: string;
  /**
   * POST.2C.3 — Seam 2. Optional, ADDITIVE, non-breaking grounding
   * snippets from real published trips (pgvector, visibility+block
   * filtered upstream in modules/feed). Passed straight through to
   * TripPlannerRequest.groundingContext. Absent → ungrounded, exactly
   * as before 2C.3. (Scope note: this PlanTool seam is the only path
   * from propose-replan to the 1.0 planner — the 2C.3 prompt's
   * Files-to-touch omits it; per the prompt's own "Verified facts
   * wins / report discrepancies" rule this is a documented, purely
   * additive deviation.)
   */
  readonly groundingContext?: readonly string[];
}

export interface DraftReplanResult {
  /** One-line summary surfaced in the user notification. */
  readonly summary: string;
  /** Which 4-tier provider produced it (badge / audit). */
  readonly provider: string;
}

export interface PlanTool {
  draftReplan(input: DraftReplanInput): Promise<DraftReplanResult>;
}

export const PLAN_TOOL_PORT = Symbol('PlanTool');
