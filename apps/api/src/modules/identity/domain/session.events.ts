/**
 * Domain events emitted by the Identity module. Subscribers can
 * key off these for notifications, analytics, and — once the
 * NotificationWorker lands — "new session from unfamiliar
 * device" email alerts.
 *
 * Installed by prompt [IV.18.2.7].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent, DomainEventOfName } from '@app/events';

export interface SessionIssuedPayload {
  readonly userId: string;
  readonly sessionId: string;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
}
export type SessionIssuedEvent = DomainEventOfName<'Identity.SessionIssued', SessionIssuedPayload>;

export function makeSessionEvent<TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  opts: { readonly traceId?: string } = {},
): DomainEvent<TPayload> & { readonly name: TName } {
  return {
    name,
    id: randomUUID(),
    version: 1,
    occurredAt: new Date(),
    ...(opts.traceId ? { traceId: opts.traceId } : {}),
    payload,
  };
}
