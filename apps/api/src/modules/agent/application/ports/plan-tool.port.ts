/**
 * POST.2A.1 — port the agent uses to draft a re-plan.
 *
 * Declared here; bound in POST.2A.4 to an adapter that delegates to
 * the EXISTING 1.0 trip planner (TRIP_PLANNER_PORT / generatePlan)
 * — no new LLM plumbing. Grounding (POST.2C.3) flows in via an
 * additive optional field on the planner request. No implementation
 * is registered in this skeleton slice.
 *
 * Installed by prompt [POST.2A.1].
 */
import type { PlanDiff } from '../../domain/plan-diff.vo';

export interface DraftReplanInput {
  readonly tripId: string;
  /** Why the loop thinks a re-plan is warranted. */
  readonly reason: string;
}

export interface DraftReplanResult {
  readonly diffs: readonly PlanDiff[];
  /** One-line summary surfaced in the user notification. */
  readonly summary: string;
}

export interface PlanTool {
  draftReplan(input: DraftReplanInput): Promise<DraftReplanResult>;
}

export const PLAN_TOOL_PORT = Symbol('PlanTool');
