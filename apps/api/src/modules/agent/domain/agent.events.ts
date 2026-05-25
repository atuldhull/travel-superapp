/**
 * POST.2A.4 — agent domain events.
 *
 * `Trip.ReplanProposed` uses the `Trip.` prefix so the notifications
 * handler routes it to the existing 'trip' category with no edit to
 * NOTIFICATION_CATEGORIES (verified). Mirrors trip/domain/trip.events
 * (same makeEvent shape) — agent owns its own factory so it doesn't
 * import another module's domain.
 *
 * Installed by prompt [POST.2A.4].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent, DomainEventOfName } from '@app/events';

export interface ReplanProposedPayload {
  /** The AgentStep id (kind='proposal') the user accepts/declines. */
  readonly proposalId: string;
  readonly agentRunId: string;
  readonly tripId: string;
  /** Who is notified — the trip owner. */
  readonly ownerId: string;
  readonly summary: string;
  readonly reason: string;
}

export type ReplanProposedEvent = DomainEventOfName<'Trip.ReplanProposed', ReplanProposedPayload>;

export function makeAgentEvent<TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  opts: { readonly traceId?: string; readonly now?: Date } = {},
): DomainEvent<TPayload> & { readonly name: TName } {
  return {
    name,
    id: randomUUID(),
    version: 1,
    occurredAt: opts.now ?? new Date(),
    ...(opts.traceId ? { traceId: opts.traceId } : {}),
    payload,
  };
}
