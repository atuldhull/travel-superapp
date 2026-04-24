/**
 * Memory-book HTTP surface.
 *
 *   POST   /api/v1/memory-books                      — create
 *   GET    /api/v1/memory-books                      — list mine
 *   GET    /api/v1/memory-books/:id                  — get one + attached asset ids
 *   PATCH  /api/v1/memory-books/:id                  — update metadata
 *   DELETE /api/v1/memory-books/:id                  — delete (SetNull on MediaAsset.memoryBookId)
 *
 * The attach/detach verb lives on the `MediaController` alongside
 * the existing attach-to-trip route (`PATCH /media/:id/memory-book`)
 * — symmetric with the trip attachment shape, keeps all media-
 * attachment operations co-located.
 *
 * Installed by prompt [IV.18.12.6].
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
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateMemoryBookUseCase } from '../application/create-memory-book.use-case';
import { DeleteMemoryBookUseCase } from '../application/delete-memory-book.use-case';
import { GetMemoryBookUseCase } from '../application/get-memory-book.use-case';
import { ListMemoryBooksUseCase } from '../application/list-memory-books.use-case';
import { UpdateMemoryBookUseCase } from '../application/update-memory-book.use-case';
import type { MemoryBook } from '../domain/memory-book.entity';
import {
  CreateMemoryBookBodySchema,
  UpdateMemoryBookBodySchema,
  type CreateMemoryBookBody,
  type UpdateMemoryBookBody,
} from './dto/media.dto';

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

@Controller('memory-books')
export class MemoryBookController {
  constructor(
    private readonly createUc: CreateMemoryBookUseCase,
    private readonly getUc: GetMemoryBookUseCase,
    private readonly listUc: ListMemoryBooksUseCase,
    private readonly updateUc: UpdateMemoryBookUseCase,
    private readonly deleteUc: DeleteMemoryBookUseCase,
  ) {}

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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ book: MemoryBookDto; assetIds: readonly string[] }> {
    const { book, assetIds } = await this.getUc.execute({ id, ownerId: user.sub });
    return { book: toDto(book), assetIds };
  }

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, ownerId: user.sub });
  }
}
