/**
 * Phase 5 (J4) — the trip-comments HTTP surface.
 *
 *   POST   /api/v1/trips/:tripId/comments   — post a comment
 *   GET    /api/v1/trips/:tripId/comments   — read the thread
 *   DELETE /api/v1/comments/:id             — delete (author / trip owner)
 *
 * Empty `@Controller()` base because the two route roots
 * (`trips/...` and `comments/...`) differ. Authenticated like every
 * business route; the actor is @CurrentUser.
 *
 * Installed by prompt [J4].
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { CreateCommentUseCase } from '../application/create-comment.use-case';
import { ListCommentsUseCase } from '../application/list-comments.use-case';
import { DeleteCommentUseCase } from '../application/delete-comment.use-case';

interface CreateCommentBody {
  readonly body?: unknown;
}

interface CommentDto {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly authorDisplayName: string | null;
  readonly body: string;
  readonly createdAt: string;
}

@ApiTags('social')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(
    private readonly createComment: CreateCommentUseCase,
    private readonly listComments: ListCommentsUseCase,
    private readonly deleteComment: DeleteCommentUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Post a comment on a published trip. 404 TRIP_NOT_COMMENTABLE if the trip is not publicly published.',
  })
  @ApiParam({ name: 'tripId', description: 'Published trip to comment on' })
  @Post('trips/:tripId/comments')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body() body: CreateCommentBody,
  ): Promise<CommentDto> {
    const comment = await this.createComment.execute({
      tripId,
      authorId: user.sub,
      body: typeof body?.body === 'string' ? body.body : '',
    });
    return {
      id: comment.id,
      tripId: comment.tripId,
      authorId: comment.authorId,
      // The create path doesn't join the author name; the thread GET
      // does. The web optimistically renders the caller's own name.
      authorDisplayName: null,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  @ApiOperation({
    summary:
      "A published trip's comment thread, oldest first. Block-filtered against the caller. Not-commentable trip → empty.",
  })
  @ApiParam({ name: 'tripId', description: 'Trip whose thread to read' })
  @ApiQuery({ name: 'limit', required: false, description: '1..200, default 100' })
  @Get('trips/:tripId/comments')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Query('limit') limit?: string,
  ): Promise<{ comments: readonly CommentDto[]; count: number }> {
    const parsed = limit !== undefined ? Number.parseInt(limit, 10) : undefined;
    const list = await this.listComments.execute({
      tripId,
      viewerId: user.sub,
      ...(parsed !== undefined && Number.isFinite(parsed) ? { limit: parsed } : {}),
    });
    return {
      comments: list.map((c) => ({
        id: c.id,
        tripId: c.tripId,
        authorId: c.authorId,
        authorDisplayName: c.authorDisplayName,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
      count: list.length,
    };
  }

  @ApiOperation({
    summary: 'Delete a comment (author or the trip owner). 404 for anyone else.',
  })
  @ApiParam({ name: 'id', description: 'Comment id' })
  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ deleted: true }> {
    await this.deleteComment.execute({ commentId: id, callerId: user.sub });
    return { deleted: true };
  }
}
