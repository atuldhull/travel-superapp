/**
 * Public API of the Social module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { SocialModule } from './social.module';

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
