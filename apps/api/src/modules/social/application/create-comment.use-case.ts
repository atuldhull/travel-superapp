/**
 * Phase 5 (J4) — post a comment on a published trip.
 *
 * Gates:
 *   - the trip must have a non-PRIVATE, published `TripPublication`
 *     (you comment on feed content, not someone's private trip);
 *   - the commenter must not be in a block relationship with the
 *     trip's author (reuses `assertNotBlocked`, the same gate the
 *     review / vote use-cases run);
 *   - body is non-empty and ≤ MAX_COMMENT_LENGTH after trim.
 *
 * Installed by prompt [J4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { NotFoundError, ValidationError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import type { TripComment } from '../domain/trip-comment.entity';
import { MAX_COMMENT_LENGTH } from '../domain/trip-comment.entity';
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
    const body = cmd.body.trim();
    if (body.length === 0) {
      throw new ValidationError(
        'Comment cannot be empty',
        { body: ['must be non-empty'] },
        {},
        'INVALID_COMMENT_BODY',
      );
    }
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new ValidationError(
        'Comment too long',
        { body: [`must be ≤ ${MAX_COMMENT_LENGTH} chars (got ${body.length})`] },
        { length: body.length },
        'INVALID_COMMENT_BODY',
      );
    }

    // Publish gate — only published, non-PRIVATE trips are commentable.
    const trip = await this.comments.findCommentableTrip(cmd.tripId);
    if (!trip) {
      throw new NotFoundError(
        'Trip is not open for comments',
        { tripId: cmd.tripId },
        'TRIP_NOT_COMMENTABLE',
      );
    }

    // Block gate — skip when the commenter IS the trip author
    // (you can always comment on your own published trip).
    if (trip.authorId !== cmd.authorId) {
      await assertNotBlocked(this.blocks, cmd.authorId, trip.authorId);
    }

    const comment = await this.comments.create({
      tripId: cmd.tripId,
      authorId: cmd.authorId,
      body,
    });

    // J6 — notify the trip's author. The handler skips self-comments,
    // but we also skip emitting one to keep the bus quiet.
    if (trip.authorId !== cmd.authorId) {
      const evt: TripCommentedEvent = makeEvent(
        'Social.TripCommented',
        {
          tripId: cmd.tripId,
          commentId: comment.id,
          tripAuthorId: trip.authorId,
          commenterId: cmd.authorId,
        },
        getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
      );
      await this.events.publish(evt);
    }
    return comment;
  }
}
