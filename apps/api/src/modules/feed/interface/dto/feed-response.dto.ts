/**
 * Class-based response DTOs for the Activity Feed HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.66].
 */
import { ApiProperty } from '@nestjs/swagger';

export class FeedItemDto {
  @ApiProperty({
    description:
      'Activity discriminator: trip.created | trip.updated | review.authored | memory_book.published | scam.reported | etc.',
  })
  declare kind: string;

  @ApiProperty({ format: 'date-time', description: 'ISO-8601 timestamp of the activity.' })
  declare occurredAt: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Activity-specific payload. Shape varies per `kind`.',
  })
  declare payload: Record<string, unknown>;
}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedItemDto], description: "Caller's recent activity, newest-first." })
  declare items: FeedItemDto[];

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'Pagination cursor (exclusive ISO timestamp); null when stream is exhausted.',
  })
  declare nextBefore: string | null;
}
