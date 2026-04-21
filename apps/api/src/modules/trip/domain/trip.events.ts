/**
 * Domain events emitted by the Trip module. Payloads are anemic —
 * they carry IDs + the minimum context a subscriber needs to fetch
 * more state (or to make a routing decision without fetching). No
 * full domain objects, no relational graphs.
 *
 * Event names use `<Context>.<Verb><Noun>Event` convention
 * (ADR-003). Subscribers filter on `event.name`.
 *
 * Installed by prompt [IV.18.2.7].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent, DomainEventOfName } from '@app/events';

export interface TripDraftedPayload {
  readonly tripId: string;
  readonly userId: string;
  readonly title: string;
  readonly radiusKm: number;
}
export type TripDraftedEvent = DomainEventOfName<'Trip.TripDrafted', TripDraftedPayload>;

export interface TripUpdatedPayload {
  readonly tripId: string;
  readonly userId: string;
  readonly version: number;
  /** Keys present in this array are the fields that actually changed. */
  readonly changedFields: readonly ('title' | 'radiusKm' | 'startsOn' | 'endsOn')[];
}
export type TripUpdatedEvent = DomainEventOfName<'Trip.TripUpdated', TripUpdatedPayload>;

export interface TripDeletedPayload {
  readonly tripId: string;
  readonly userId: string;
}
export type TripDeletedEvent = DomainEventOfName<'Trip.TripDeleted', TripDeletedPayload>;

export interface TripItineraryGeneratedPayload {
  readonly tripId: string;
  readonly userId: string;
  readonly dayCount: number;
}
export type TripItineraryGeneratedEvent = DomainEventOfName<
  'Trip.ItineraryGenerated',
  TripItineraryGeneratedPayload
>;

export function makeEvent<TName extends string, TPayload>(
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
