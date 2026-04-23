/**
 * Domain events emitted by the Safety module. Subscribers can key
 * off these for notification fan-out (push to emergency contacts,
 * SMS to ops on-call, etc.) — landed in a follow-up notification
 * slice.
 *
 * Today `Safety.SosTriggered` fires but has no subscribers; it's a
 * hook for the future. Same pattern Identity/Trip use.
 *
 * Installed by prompt [IV.18.11.2].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent, DomainEventOfName } from '@app/events';

export interface SosTriggeredPayload {
  readonly userId: string;
  readonly sosEventId: string;
  readonly trigger: string;
  readonly lat: number;
  readonly lng: number;
}
export type SosTriggeredEvent = DomainEventOfName<'Safety.SosTriggered', SosTriggeredPayload>;

export function makeSafetyEvent<TName extends string, TPayload>(
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
