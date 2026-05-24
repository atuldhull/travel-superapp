/**
 * Phase 5 (J4) — post a comment on a published trip.
 *
 * Gates:
 *   - the trip must have a non-PRIVATE, published `TripPublication`
 *     (you comment on feed content, not someone's private trip);
 *   - the commenter must not be in a block relationship with the
 *     trip's author (reuses `assertNotBlocked`, the same gate the
 *     review / vote use-cases run);
 *   - body invariants (non-empty + ≤ MAX_COMMENT_LENGTH after trim)
 *     live on `TripComment.create()` — [G4.1].
 *
 * Installed by prompt [J4]; entity-validated by [G4.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { NotFoundError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import { TripComment } from '../domain/trip-comment.entity';
import { makeEvent, type TripCommentedEvent } from '../domain/social.events';
import { COMMENT_REPOSITORY, type CommentRepository } from './ports/comment.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';
import { assertNotBlocked } from './block-user.use-case';

export interface CreateCommentCommand {
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
}

@Injectable()
export class CreateCommentUseCase {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: CreateCommentCommand): Promise<TripComment> {
    // Domain-side body invariants (T1/T2 — [G4.1]).
    const input = TripComment.create(cmd);

    // Publish gate — only published, non-PRIVATE trips are commentable.
    const trip = await this.comments.findCommentableTrip(input.tripId);
    if (!trip) {
      throw new NotFoundError(
        'Trip is not open for comments',
        { tripId: input.tripId },
        'TRIP_NOT_COMMENTABLE',
      );
    }

    // Block gate — skip when the commenter IS the trip author
    // (you can always comment on your own published trip).
    if (trip.authorId !== input.authorId) {
      await assertNotBlocked(this.blocks, input.authorId, trip.authorId);
    }

    const comment = await this.comments.create(input);

    // J6 — notify the trip's author. The handler skips self-comments,
    // but we also skip emitting one to keep the bus quiet.
    if (trip.authorId !== input.authorId) {
      const evt: TripCommentedEvent = makeEvent(
        'Social.TripCommented',
        {
          tripId: input.tripId,
          commentId: comment.id,
          tripAuthorId: trip.authorId,
          commenterId: input.authorId,
        },
        getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
      );
      await this.events.publish(evt);
    }
    return comment;
  }
}
