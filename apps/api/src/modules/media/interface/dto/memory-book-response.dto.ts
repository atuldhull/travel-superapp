/**
 * Class-based response DTOs for the memory-book public surface.
 * `@nestjs/swagger` needs classes (not interfaces) decorated with
 * `@ApiProperty` to emit real component schemas in `openapi.yaml`.
 * With these in place orval generates strongly-typed return shapes
 * instead of `data: void` for the public discovery endpoints.
 *
 * Owner-scoped routes (`MemoryBookDto`) are not class-ified yet —
 * those land in a follow-up slice along with the full owner-side
 * trip + media surface. This slice covers the three top-priority
 * public surfaces (featured + public/:id + identity/login).
 *
 * Installed by prompt [IV.18.19.20].
 */
import { ApiProperty } from '@nestjs/swagger';

export class PublicMemoryBookDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Public title chosen by the owner.' })
  declare title: string;

  @ApiProperty({ description: 'Theme slug (e.g. "minimal", "vintage").' })
  declare theme: string;

  @ApiProperty({
    nullable: true,
    description: 'S3 key of the cover image, or null if none was set.',
  })
  declare coverS3Key: string | null;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the book was published.',
  })
  declare publishedAt: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class FeaturedMemoryBooksResponseDto {
  @ApiProperty({
    type: [PublicMemoryBookDto],
    description: 'Currently-published memory books, ordered by publishedAt DESC.',
  })
  declare books: PublicMemoryBookDto[];
}

export class PublicMemoryBookWithAssetsResponseDto {
  @ApiProperty({ type: PublicMemoryBookDto })
  declare book: PublicMemoryBookDto;

  @ApiProperty({
    type: [String],
    description:
      'Asset ids attached to this published book. Use ' +
      'GET /memory-books/public/:id/assets/:assetId/download-url to mint a presigned URL per asset.',
  })
  declare assetIds: string[];
}
