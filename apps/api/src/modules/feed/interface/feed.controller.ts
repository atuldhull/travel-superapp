/**
 * Activity feed HTTP surface.
 *
 *   GET /api/v1/feed/me?limit=&before=
 *
 * Returns the caller's recent activity merged across trip
 * creates/edits, reviews authored, memory book publishes, and
 * scam reports filed. Cursor pagination via `before` (ISO
 * timestamp; exclusive). `nextBefore` is `null` when the
 * stream has no more pages.
 *
 * Auth: standard `JwtAuthGuard` — caller's own activity only.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { GetMyFeedUseCase, type GetMyFeedResult } from '../application/get-my-feed.use-case';
import type { FeedItem } from '../domain/feed-item.entity';

interface FeedItemDto {
  readonly kind: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

interface FeedResponseDto {
  readonly items: readonly FeedItemDto[];
  readonly nextBefore: string | null;
}

function toDto(item: FeedItem): FeedItemDto {
  return {
    kind: item.kind,
    occurredAt: item.occurredAt.toISOString(),
    payload: item.payload as unknown as Readonly<Record<string, unknown>>,
  };
}

@Controller('feed')
export class FeedController {
  constructor(private readonly getMyFeed: GetMyFeedUseCase) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<FeedResponseDto> {
    let parsedBefore: Date | undefined;
    if (before !== undefined) {
      const d = new Date(before);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'before must be a valid ISO timestamp',
        });
      }
      parsedBefore = d;
    }
    const parsedLimit = limit ? Number(limit) : undefined;
    if (limit !== undefined && (Number.isNaN(parsedLimit!) || parsedLimit! < 1)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'limit must be a positive integer',
      });
    }
    const result: GetMyFeedResult = await this.getMyFeed.execute({
      userId: user.sub,
      ...(parsedBefore ? { before: parsedBefore } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    });
    return {
      items: result.items.map(toDto),
      nextBefore: result.nextBefore ? result.nextBefore.toISOString() : null,
    };
  }
}
