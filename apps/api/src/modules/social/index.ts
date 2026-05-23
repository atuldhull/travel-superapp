/**
 * Public API of the Social module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `SocialModule` —
 * cross-module DI imports use `./social.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/block.repository';
export * from './application/ports/comment.repository';
export * from './application/ports/expense.repository';
export * from './application/ports/follow.repository';
export * from './application/ports/helpful-vote.repository';
export * from './application/ports/karma.repository';
export * from './application/ports/review.repository';
export * from './application/ports/trip-balances-cache.port';
export * from './application/ports/trip-heart-counter.port';
export * from './application/ports/vote.repository';

// Public event payload types — notifications handlers consume
// these for follow + comment alert flows. `makeEvent` factory
// stays private to social.
export type {
  TripCommentedEvent,
  TripCommentedPayload,
  UserFollowedEvent,
  UserFollowedPayload,
} from './domain/social.events';
