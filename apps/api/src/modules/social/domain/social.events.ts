/**
 * Phase 5 (J6) — domain events emitted by the social module.
 *
 * Anemic payloads (IDs only) — the notifications handlers fetch the
 * display names / titles they render. Same `<Context>.<Verb><Noun>`
 * convention + local `makeEvent` as `trip.events.ts` (each module
 * owns its own event construction — no cross-module domain import).
 *
 * Installed by prompt [J6].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent, DomainEventOfName } from '@app/events';

/** Emitted when one user follows another. The notifications handler
 *  turns it into a "X started following you" inbox entry. */
export interface UserFollowedPayload {
  readonly followerId: string;
  readonly followeeId: string;
}
export type UserFollowedEvent = DomainEventOfName<'Social.UserFollowed', UserFollowedPayload>;

/** Emitted when a comment is posted on a published trip. The handler
 *  notifies the trip's author (skipping self-comments). */
export interface TripCommentedPayload {
  readonly tripId: string;
  readonly commentId: string;
  readonly tripAuthorId: string;
  readonly commenterId: string;
}
export type TripCommentedEvent = DomainEventOfName<'Social.TripCommented', TripCommentedPayload>;

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
