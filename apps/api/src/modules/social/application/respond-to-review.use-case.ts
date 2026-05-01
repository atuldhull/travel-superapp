/**
 * V.UX.24 — agent (target-owner) reply to a review about themselves.
 * Owner-gated:
 *
 *   1. Caller must hold an Agent row (404 AGENT_PROFILE_NOT_FOUND).
 *   2. Review must exist (404 REVIEW_NOT_FOUND).
 *   3. Review's targetType must be 'agent' AND targetId must equal
 *      the caller's Agent.id (403 REVIEW_RESPONSE_FORBIDDEN).
 *   4. Review must not already carry a response (409
 *      REVIEW_RESPONSE_LOCKED) — the wire is one-shot for v1.
 *
 * `responseBody` is trimmed + length-capped at the use-case so the
 * controller's Zod schema only enforces shape.
 *
 * Lives in the social module because the persistence target is the
 * `Review` row; the agent gate goes through the cross-module
 * `AGENT_REPOSITORY` exported by SafetyModule.
 *
 * Installed by prompt [V.UX.24].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@app/errors';
import {
  AGENT_REPOSITORY,
  type AgentRepository,
} from '../../safety/application/ports/agent.repository';
import type { Review } from '../domain/review.entity';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

const MAX_RESPONSE_CHARS = 2000;

export interface RespondToReviewCommand {
  readonly userId: string;
  readonly reviewId: string;
  readonly responseBody: string;
}

@Injectable()
export class RespondToReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(AGENT_REPOSITORY) private readonly agents: AgentRepository,
  ) {}

  async execute(cmd: RespondToReviewCommand): Promise<Review> {
    const trimmed = cmd.responseBody.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_RESPONSE_CHARS) {
      throw new ValidationError(
        `responseBody must be 1..${MAX_RESPONSE_CHARS} chars`,
        { responseBody: ['out of range'] },
        { len: trimmed.length },
        'INVALID_REVIEW_RESPONSE',
      );
    }

    const agent = await this.agents.findByUserId(cmd.userId);
    if (!agent) {
      throw new NotFoundError(
        'Agent profile not found',
        { userId: cmd.userId },
        'AGENT_PROFILE_NOT_FOUND',
      );
    }

    const review = await this.reviews.findById(cmd.reviewId);
    if (!review) {
      throw new NotFoundError('Review not found', { reviewId: cmd.reviewId }, 'REVIEW_NOT_FOUND');
    }
    if (review.targetType !== 'agent' || review.targetId !== agent.id) {
      throw new ForbiddenError(
        'You can only respond to reviews about yourself',
        { reviewId: cmd.reviewId, agentId: agent.id },
        'REVIEW_RESPONSE_FORBIDDEN',
      );
    }

    const updated = await this.reviews.setResponse({
      id: cmd.reviewId,
      responseBody: trimmed,
    });
    if (!updated) {
      // setResponse's conditional update returned 0 — the row already
      // has a response (or it was deleted between findById + the
      // conditional update; same surface either way).
      throw new ConflictError(
        'Review response is already set',
        { reviewId: cmd.reviewId },
        'REVIEW_RESPONSE_LOCKED',
      );
    }
    return updated;
  }
}
