/**
 * POST.2B.1 — the social-graph HTTP surface.
 *
 *   POST   /api/v1/users/:id/follow
 *   DELETE /api/v1/users/:id/follow
 *   POST   /api/v1/users/:id/block
 *   DELETE /api/v1/users/:id/block
 *
 * Deliberately a NEW controller, not social.controller.ts — that one
 * is `@Controller('trips/:tripId/votes')` (verified), wrong scope for
 * user→user graph routes. Authenticated like every business route;
 * the actor is @CurrentUser, the target is the :id param.
 *
 * Installed by prompt [POST.2B.1].
 */
import { Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { FollowUseCase } from '../application/follow.use-case';
import { UnfollowUseCase } from '../application/unfollow.use-case';
import { BlockUserUseCase } from '../application/block-user.use-case';
import { UnblockUserUseCase } from '../application/unblock-user.use-case';

@ApiTags('social-graph')
@ApiBearerAuth()
@Controller('users')
export class FollowController {
  constructor(
    private readonly followUc: FollowUseCase,
    private readonly unfollowUc: UnfollowUseCase,
    private readonly blockUc: BlockUserUseCase,
    private readonly unblockUc: UnblockUserUseCase,
  ) {}

  @ApiOperation({ summary: 'Follow a user (idempotent; self-follow 422; blocked pair 403).' })
  @ApiParam({ name: 'id', description: 'User to follow' })
  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ following: true }> {
    await this.followUc.execute({ followerId: user.sub, followeeId: id });
    return { following: true };
  }

  @ApiOperation({ summary: 'Unfollow a user (idempotent).' })
  @ApiParam({ name: 'id', description: 'User to unfollow' })
  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ following: false }> {
    await this.unfollowUc.execute({ followerId: user.sub, followeeId: id });
    return { following: false };
  }

  @ApiOperation({ summary: 'Block a user (idempotent; self-block 422).' })
  @ApiParam({ name: 'id', description: 'User to block' })
  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ blocked: true }> {
    await this.blockUc.execute({ blockerId: user.sub, blockedId: id });
    return { blocked: true };
  }

  @ApiOperation({ summary: 'Unblock a user (idempotent).' })
  @ApiParam({ name: 'id', description: 'User to unblock' })
  @Delete(':id/block')
  @HttpCode(HttpStatus.OK)
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ blocked: false }> {
    await this.unblockUc.execute({ blockerId: user.sub, blockedId: id });
    return { blocked: false };
  }
}
