/**
 * POST.2A.2 — one append-only entry in an agent run's audit log.
 *
 * Mirrors the AgentStep table. The repository port exposes append +
 * read ONLY — there is deliberately no "edit step" / "delete step"
 * (same read-only-by-design contract as AdminAuditLog). Plain
 * readonly interface per the project's domain convention.
 *
 * Installed by prompt [POST.2A.2].
 */

/** What an agent step records. Free-form at the DB layer so new
 *  kinds land without a migration; typed here for callers. */
export type AgentStepKind =
  | 'watch_started'
  | 'signal_seen'
  | 'proposal'
  | 'accepted'
  | 'declined'
  | 'watch_closed';

export interface AgentStep {
  readonly id: string;
  readonly agentRunId: string;
  readonly kind: AgentStepKind;
  /** Small per-step payload (< 1 KB); never secrets / PII. */
  readonly detail: Readonly<Record<string, unknown>> | null;
  readonly createdAt: Date;
}
