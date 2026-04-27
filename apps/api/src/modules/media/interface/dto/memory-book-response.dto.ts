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

/**
 * V.UX.11 — slim asset summary returned alongside the book on
 * read paths. Lets the public viewer + owner editor render
 * captions inline without N round-trips.
 */
export class MemoryBookAssetSummaryDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ enum: ['image', 'video'] })
  declare kind: string;

  @ApiProperty({ nullable: true, maxLength: 280 })
  declare caption: string | null;

  @ApiProperty({ description: '0-based ordering within the book.' })
  declare position: number;
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

  @ApiProperty({
    type: [MemoryBookAssetSummaryDto],
    description: 'V.UX.11 — same assets enriched with caption + position for story mode.',
  })
  declare assets: MemoryBookAssetSummaryDto[];
}

export class PublicDownloadUrlResponseDto {
  @ApiProperty({
    description:
      'Short-lived presigned GET URL for the asset bytes. Tagged with the bucket + a TTL ~5 min.',
  })
  declare url: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the presigned URL expires.',
  })
  declare expiresAt: string;
}

// ─── Owner-side surface ──────────────────────────────────────────
//
// Symmetric with the public surface above but exposes the full
// row (including ownerId + updatedAt + the nullable publishedAt).
// Used by the 7 owner-scoped routes on `MemoryBookController`.
//
// Installed by prompt [IV.18.19.51].

export class MemoryBookDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid', description: 'Owner of the book — caller-only on owner routes.' })
  declare ownerId: string;

  @ApiProperty()
  declare title: string;

  @ApiProperty({ description: 'Theme slug (e.g. "minimal", "vintage").' })
  declare theme: string;

  @ApiProperty({ nullable: true })
  declare coverS3Key: string | null;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601 publish timestamp; null while the book is a draft.',
  })
  declare publishedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ListMemoryBooksResponseDto {
  @ApiProperty({
    type: [MemoryBookDto],
    description: 'Caller-owned memory books, newest first. Default 50 / cap 200.',
  })
  declare books: MemoryBookDto[];
}

export class MemoryBookWithAssetsResponseDto {
  @ApiProperty({ type: MemoryBookDto })
  declare book: MemoryBookDto;

  @ApiProperty({
    type: [String],
    description: 'Asset ids attached to this book (any status).',
  })
  declare assetIds: string[];

  @ApiProperty({
    type: [MemoryBookAssetSummaryDto],
    description: 'V.UX.11 — same assets enriched with caption + position.',
  })
  declare assets: MemoryBookAssetSummaryDto[];
}

export class CreateMemoryBookRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  declare title: string;

  @ApiProperty({ required: false, maxLength: 32 })
  declare theme?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 512 })
  declare coverS3Key?: string | null;
}

export class UpdateMemoryBookRequestDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 120 })
  declare title?: string;

  @ApiProperty({ required: false, minLength: 1, maxLength: 32 })
  declare theme?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 512 })
  declare coverS3Key?: string | null;
}
