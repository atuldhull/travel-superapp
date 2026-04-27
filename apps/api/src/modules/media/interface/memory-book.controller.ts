/**
 * Memory-book HTTP surface.
 *
 *   POST   /api/v1/memory-books                                — create
 *   GET    /api/v1/memory-books                                — list mine
 *   GET    /api/v1/memory-books/:id                            — get one + attached asset ids
 *   PATCH  /api/v1/memory-books/:id                            — update metadata
 *   DELETE /api/v1/memory-books/:id                            — delete (SetNull on MediaAsset.memoryBookId)
 *   POST   /api/v1/memory-books/:id/publish                    — flip publishedAt = now
 *   POST   /api/v1/memory-books/:id/unpublish                  — clear publishedAt
 *   GET    /api/v1/memory-books/public/:id                     — @Public() — public read of published book
 *   GET    /api/v1/memory-books/public/:id/assets/:assetId/download-url — @Public() — presigned URL
 *
 * The attach/detach verb lives on the `MediaController` alongside
 * the existing attach-to-trip route (`PATCH /media/:id/memory-book`)
 * — symmetric with the trip attachment shape, keeps all media-
 * attachment operations co-located.
 *
 * Installed by prompt [IV.18.12.6]. Publish flow added in [IV.18.12.7].
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateMemoryBookUseCase } from '../application/create-memory-book.use-case';
import { DeleteMemoryBookUseCase } from '../application/delete-memory-book.use-case';
import { GetMemoryBookUseCase } from '../application/get-memory-book.use-case';
import { GetPublishedAssetDownloadUrlUseCase } from '../application/get-published-asset-download-url.use-case';
import { GetPublishedMemoryBookUseCase } from '../application/get-published-memory-book.use-case';
import { ListMemoryBooksUseCase } from '../application/list-memory-books.use-case';
import { ListPublishedMemoryBooksUseCase } from '../application/list-published-memory-books.use-case';
import { PublishMemoryBookUseCase } from '../application/publish-memory-book.use-case';
import { UnpublishMemoryBookUseCase } from '../application/unpublish-memory-book.use-case';
import { UpdateAssetCaptionUseCase } from '../application/update-asset-caption.use-case';
import { UpdateMemoryBookUseCase } from '../application/update-memory-book.use-case';
import type { MemoryBook } from '../domain/memory-book.entity';
import {
  CreateMemoryBookBodySchema,
  UpdateAssetCaptionBodySchema,
  UpdateMemoryBookBodySchema,
  type CreateMemoryBookBody,
  type UpdateAssetCaptionBody,
  type UpdateMemoryBookBody,
} from './dto/media.dto';
import {
  MediaAssetDto as MediaAssetResponseDto,
  UpdateAssetCaptionRequestDto,
} from './dto/media-response.dto';
import {
  CreateMemoryBookRequestDto,
  FeaturedMemoryBooksResponseDto,
  ListMemoryBooksResponseDto,
  MemoryBookDto as MemoryBookResponseDto,
  MemoryBookWithAssetsResponseDto,
  PublicDownloadUrlResponseDto,
  PublicMemoryBookWithAssetsResponseDto,
  UpdateMemoryBookRequestDto,
} from './dto/memory-book-response.dto';

interface MemoryBookDto {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly theme: string;
  readonly coverS3Key: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(b: MemoryBook): MemoryBookDto {
  return {
    id: b.id,
    ownerId: b.ownerId,
    title: b.title,
    theme: b.theme,
    coverS3Key: b.coverS3Key,
    publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

interface PublicBookDto {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly coverS3Key: string | null;
  readonly publishedAt: string;
  readonly createdAt: string;
}

function toPublicDto(b: MemoryBook): PublicBookDto {
  return {
    id: b.id,
    title: b.title,
    theme: b.theme,
    coverS3Key: b.coverS3Key,
    // Non-null by contract — `findPublishedById` only returns rows
    // where `publishedAt IS NOT NULL`. Cast is safe.
    publishedAt: (b.publishedAt as Date).toISOString(),
    createdAt: b.createdAt.toISOString(),
  };
}

@ApiTags('media')
@ApiBearerAuth()
@Controller('memory-books')
export class MemoryBookController {
  constructor(
    private readonly createUc: CreateMemoryBookUseCase,
    private readonly getUc: GetMemoryBookUseCase,
    private readonly listUc: ListMemoryBooksUseCase,
    private readonly updateUc: UpdateMemoryBookUseCase,
    private readonly deleteUc: DeleteMemoryBookUseCase,
    private readonly publishUc: PublishMemoryBookUseCase,
    private readonly unpublishUc: UnpublishMemoryBookUseCase,
    private readonly getPublishedUc: GetPublishedMemoryBookUseCase,
    private readonly publishedAssetDlUc: GetPublishedAssetDownloadUrlUseCase,
    private readonly listPublishedUc: ListPublishedMemoryBooksUseCase,
    private readonly updateAssetCaptionUc: UpdateAssetCaptionUseCase,
  ) {}

  // ─── Public-read routes — declared first so Nest's order-of-
  //     declaration route matcher can't accidentally shadow them
  //     with the `:id` paths below. (`'public'` / `'featured'`
  //     are literal segments, so this is belt-and-braces, not
  //     strictly required.) ───────────────────────────────────

  /**
   * Public discovery — currently-published memory books across
   * all users, most-recently-published first. Drives the
   * marketing / explore surface. Default limit 20, cap 100.
   * Added by `[IV.18.13.1]`.
   */
  @ApiOperation({
    summary:
      'Public discovery — currently-published memory books across all users, ordered by publishedAt DESC.',
  })
  @ApiResponse({
    status: 200,
    description: 'Currently-published memory books, newest-first.',
    type: FeaturedMemoryBooksResponseDto,
  })
  @Public()
  @Get('featured')
  @HttpCode(HttpStatus.OK)
  async featured(@Query('limit') limit?: string): Promise<{ books: PublicBookDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(100, Number(limit) || 20)) : undefined;
    const books = await this.listPublishedUc.execute(parsed);
    return { books: books.map(toPublicDto) };
  }

  @ApiOperation({
    summary: 'Public read of a published memory book by id. The cuid is the unguessable token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Published book metadata + ids of attached assets.',
    type: PublicMemoryBookWithAssetsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_PUBLISHED.' })
  @Public()
  @Get('public/:id')
  @HttpCode(HttpStatus.OK)
  async getPublic(@Param('id') id: string): Promise<{
    book: PublicBookDto;
    assetIds: readonly string[];
    assets: ReadonlyArray<{
      id: string;
      kind: string;
      caption: string | null;
      position: number;
    }>;
  }> {
    const { book, assetIds, assets } = await this.getPublishedUc.execute(id);
    return { book: toPublicDto(book), assetIds, assets };
  }

  @ApiOperation({
    summary:
      'Public presigned download URL for a memory-book asset. Three-clause gate: book published + asset attached + asset ready.',
  })
  @ApiResponse({
    status: 200,
    description: 'Short-lived presigned GET URL + ISO expiry.',
    type: PublicDownloadUrlResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'BOOK_NOT_PUBLISHED, MEDIA_NOT_FOUND, or NOT_ATTACHED.',
  })
  @Public()
  @Get('public/:id/assets/:assetId/download-url')
  @HttpCode(HttpStatus.OK)
  async getPublicAssetDownloadUrl(
    @Param('id') bookId: string,
    @Param('assetId') assetId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const { url, expiresAt } = await this.publishedAssetDlUc.execute({ bookId, assetId });
    return { url, expiresAt: expiresAt.toISOString() };
  }

  @ApiOperation({ summary: 'Create a memory book (draft). Owner = caller.' })
  @ApiBody({ type: CreateMemoryBookRequestDto })
  @ApiResponse({ status: 201, description: 'Newly-created book row.', type: MemoryBookResponseDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateMemoryBookBodySchema)) body: CreateMemoryBookBody,
  ): Promise<MemoryBookDto> {
    const book = await this.createUc.execute({
      ownerId: user.sub,
      title: body.title,
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.coverS3Key !== undefined ? { coverS3Key: body.coverS3Key } : {}),
    });
    return toDto(book);
  }

  @ApiOperation({
    summary:
      "List the caller's memory books, newest first. ?limit=N (1..200, default 50). Owner-scoped.",
  })
  @ApiResponse({
    status: 200,
    description: 'Caller-owned memory books, newest first.',
    type: ListMemoryBooksResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ books: MemoryBookDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const books = await this.listUc.execute(user.sub, parsed);
    return { books: books.map(toDto) };
  }

  @ApiOperation({ summary: 'Get one of the caller-owned books + the attached asset ids.' })
  @ApiResponse({
    status: 200,
    description: 'Book row + ids of attached assets (any status).',
    type: MemoryBookWithAssetsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_FOUND.' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{
    book: MemoryBookDto;
    assetIds: readonly string[];
    assets: ReadonlyArray<{
      id: string;
      kind: string;
      caption: string | null;
      position: number;
    }>;
  }> {
    const { book, assetIds, assets } = await this.getUc.execute({ id, ownerId: user.sub });
    return { book: toDto(book), assetIds, assets };
  }

  @ApiOperation({ summary: 'Update one of the caller-owned books. Partial update.' })
  @ApiBody({ type: UpdateMemoryBookRequestDto })
  @ApiResponse({ status: 200, description: 'Updated book row.', type: MemoryBookResponseDto })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_FOUND.' })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMemoryBookBodySchema)) body: UpdateMemoryBookBody,
  ): Promise<MemoryBookDto> {
    const book = await this.updateUc.execute({
      id,
      ownerId: user.sub,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.coverS3Key !== undefined ? { coverS3Key: body.coverS3Key } : {}),
    });
    return toDto(book);
  }

  @ApiOperation({
    summary: 'Delete one of the caller-owned books. SetNull on MediaAsset.memoryBookId.',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, ownerId: user.sub });
  }

  @ApiOperation({ summary: 'Publish a book — flips publishedAt to now (idempotent).' })
  @ApiResponse({ status: 200, description: 'Published book row.', type: MemoryBookResponseDto })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_FOUND.' })
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MemoryBookDto> {
    const book = await this.publishUc.execute({ id, ownerId: user.sub });
    return toDto(book);
  }

  @ApiOperation({ summary: 'Unpublish a book — clears publishedAt (idempotent).' })
  @ApiResponse({ status: 200, description: 'Updated book row.', type: MemoryBookResponseDto })
  @ApiResponse({ status: 404, description: 'BOOK_NOT_FOUND.' })
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MemoryBookDto> {
    const book = await this.unpublishUc.execute({ id, ownerId: user.sub });
    return toDto(book);
  }

  /**
   * V.UX.11 — set or clear an asset's caption. Owner-only;
   * `assetId` must already be attached to `:id`. Empty/blank caption
   * stores `null`.
   */
  @ApiOperation({
    summary: "Set or clear an asset's caption (story-mode narrative). Owner-only.",
  })
  @ApiBody({ type: UpdateAssetCaptionRequestDto })
  @ApiResponse({ status: 200, description: 'Updated asset row.', type: MediaAssetResponseDto })
  @ApiResponse({ status: 404, description: 'MEDIA_NOT_FOUND.' })
  @Patch(':id/assets/:assetId/caption')
  @HttpCode(HttpStatus.OK)
  async updateAssetCaption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body(new ZodValidationPipe(UpdateAssetCaptionBodySchema)) body: UpdateAssetCaptionBody,
  ): Promise<{
    id: string;
    ownerId: string;
    tripId: string | null;
    memoryBookId: string | null;
    kind: string;
    status: string;
    caption: string | null;
    position: number;
    createdAt: string;
  }> {
    const asset = await this.updateAssetCaptionUc.execute({
      memoryBookId: id,
      assetId,
      ownerId: user.sub,
      caption: body.caption,
    });
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      tripId: asset.tripId,
      memoryBookId: asset.memoryBookId,
      kind: asset.kind,
      status: asset.status,
      caption: asset.caption,
      position: asset.position,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
