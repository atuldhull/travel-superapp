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
import {
  BadRequestException,
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { GetMyFeedUseCase, type GetMyFeedResult } from '../application/get-my-feed.use-case';
import { PublishTripUseCase } from '../application/publish-trip.use-case';
import { UnpublishTripUseCase } from '../application/unpublish-trip.use-case';
import { GetFeedUseCase } from '../application/get-feed.use-case';
import { GetCreatorProfileUseCase } from '../application/get-creator-profile.use-case';
import type { TripPublication, Visibility } from '../domain/trip-publication.entity';
import type { FeedItem } from '../domain/feed-item.entity';

const VISIBILITIES: readonly Visibility[] = ['PRIVATE', 'FOLLOWERS', 'PUBLIC'];

interface PublishBody {
  readonly visibility?: Visibility;
  readonly preciseGeoOptIn?: boolean;
}

interface TripPublicationDto {
  readonly tripId: string;
  readonly visibility: Visibility;
  readonly exposedLat: number | null;
  readonly exposedLng: number | null;
  readonly publishedAt: string | null;
}

function pubToDto(p: TripPublication): TripPublicationDto {
  return {
    tripId: p.tripId,
    visibility: p.visibility,
    exposedLat: p.exposedLat,
    exposedLng: p.exposedLng,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  };
}
import { FeedResponseDto as FeedResponseDtoSwagger } from './dto/feed-response.dto';

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

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(
    private readonly getMyFeed: GetMyFeedUseCase,
    private readonly publishTrip: PublishTripUseCase,
    private readonly unpublishTrip: UnpublishTripUseCase,
    private readonly getFeed: GetFeedUseCase,
    private readonly getCreatorProfile: GetCreatorProfileUseCase,
  ) {}

  @ApiOperation({
    summary:
      'The social pull feed — published trips from people you follow + public, reverse-chron, cursor (?before, ?limit). Visibility + block filtered.',
  })
  @ApiResponse({ status: 200, description: 'Feed page + nextBefore cursor.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async socialFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<{ items: readonly TripPublicationDto[]; nextBefore: string | null }> {
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
    const result = await this.getFeed.execute({
      viewerId: user.sub,
      ...(parsedBefore ? { before: parsedBefore } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    });
    return {
      items: result.items.map(pubToDto),
      nextBefore: result.nextBefore ? result.nextBefore.toISOString() : null,
    };
  }

  @ApiOperation({ summary: "A creator's profile — their visible published trips + counts." })
  @ApiParam({ name: 'id', description: 'Creator (user) id' })
  @ApiResponse({ status: 200, description: 'Creator profile.' })
  @Get('creators/:id')
  @HttpCode(HttpStatus.OK)
  async creator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{
    authorId: string;
    followerCount: number;
    publishedCount: number;
    trips: readonly TripPublicationDto[];
  }> {
    const p = await this.getCreatorProfile.execute({ authorId: id, viewerId: user.sub });
    return {
      authorId: p.authorId,
      followerCount: p.followerCount,
      publishedCount: p.publishedCount,
      trips: p.trips.map(pubToDto),
    };
  }

  @ApiOperation({
    summary:
      'Publish a trip (owner-only). Privacy-fenced: trip must have ENDED; PUBLIC coarsens geo. Default visibility FOLLOWERS.',
  })
  @ApiParam({ name: 'tripId', description: 'Trip to publish' })
  @ApiResponse({ status: 200, description: 'The publication.' })
  @ApiResponse({ status: 404, description: 'TRIP_NOT_FOUND' })
  @ApiResponse({ status: 422, description: 'TRIP_NOT_ENDED' })
  @Post('trips/:tripId/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body() body: PublishBody,
  ): Promise<TripPublicationDto> {
    if (body.visibility !== undefined && !VISIBILITIES.includes(body.visibility)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `visibility must be one of ${VISIBILITIES.join(', ')}`,
      });
    }
    const pub = await this.publishTrip.execute({
      tripId,
      userId: user.sub,
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.preciseGeoOptIn !== undefined ? { preciseGeoOptIn: body.preciseGeoOptIn } : {}),
    });
    return pubToDto(pub);
  }

  @ApiOperation({ summary: 'Unpublish a trip (owner-only; idempotent; visibility → PRIVATE).' })
  @ApiParam({ name: 'tripId', description: 'Trip to unpublish' })
  @ApiResponse({ status: 200, description: 'Unpublished (idempotent).' })
  @Delete('trips/:tripId/publish')
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
  ): Promise<{ unpublished: true }> {
    await this.unpublishTrip.execute({ tripId, userId: user.sub });
    return { unpublished: true };
  }

  @ApiOperation({
    summary:
      "List the caller's recent activity (cursor pagination via ?before=). Optional ?limit caps the page size.",
  })
  @ApiResponse({
    status: 200,
    description: 'Activity items + nextBefore cursor.',
    type: FeedResponseDtoSwagger,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED — before is not an ISO timestamp, or limit is non-positive.',
  })
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
