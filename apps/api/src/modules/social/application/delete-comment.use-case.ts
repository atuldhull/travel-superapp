/**
 * Phase 5 (J4) — delete a comment.
 *
 * Allowed for the comment's author OR the published trip's author
 * (the trip owner can moderate their own thread). Anyone else gets
 * a 404 — the existence-probe-safe response, consistent with the
 * owner-gates elsewhere in this codebase (a non-owner must not be
 * able to tell a comment from a typo'd id).
 *
 * Installed by prompt [J4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { COMMENT_REPOSITORY, type CommentRepository } from './ports/comment.repository';

export interface DeleteCommentCommand {
  readonly commentId: string;
  readonly callerId: string;
}

@Injectable()
export class DeleteCommentUseCase {
  constructor(@Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository) {}

  async execute(cmd: DeleteCommentCommand): Promise<void> {
    const comment = await this.comments.findById(cmd.commentId);
    if (!comment) {
      throw new NotFoundError(
        'Comment not found',
        { commentId: cmd.commentId },
        'COMMENT_NOT_FOUND',
      );
    }

    let allowed = comment.authorId === cmd.callerId;
    if (!allowed) {
      // The trip's published author may moderate their own thread.
      const trip = await this.comments.findCommentableTrip(comment.tripId);
      allowed = trip !== null && trip.authorId === cmd.callerId;
    }
    if (!allowed) {
      // 404, not 403 — never confirm the comment exists to a
      // non-author / non-owner (existence-probe defence).
      throw new NotFoundError(
        'Comment not found',
        { commentId: cmd.commentId },
        'COMMENT_NOT_FOUND',
      );
    }

    await this.comments.delete(cmd.commentId);
  }
}
