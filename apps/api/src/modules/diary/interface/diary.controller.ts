/**
 * Diary HTTP surface (auth-gated; userId always from the JWT, never
 * the body — CLAUDE.md auth posture).
 *
 *   POST /api/v1/diary/entries        → create + award gamification
 *   GET  /api/v1/diary/entries        → list (newest first; ?tripId ?limit)
 *   GET  /api/v1/diary/gamification   → points/streak + badge shelf
 *   POST /api/v1/diary/assist         → AI assist (prompt|polish|title)
 *
 * Installed for the adventure-diary feature.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateDiaryEntryUseCase } from '../application/create-diary-entry.use-case';
import { ListDiaryEntriesUseCase } from '../application/list-diary-entries.use-case';
import { GetGamificationUseCase } from '../application/get-gamification.use-case';
import { AssistDiaryUseCase } from '../application/assist-diary.use-case';
import {
  AssistDiaryBodySchema,
  type AssistDiaryBody,
  CreateDiaryEntryBodySchema,
  type CreateDiaryEntryBody,
} from './dto/diary.dto';
import {
  AssistDiaryResponseDto,
  CreateDiaryEntryResponseDto,
  GamificationViewDto,
  ListDiaryEntriesResponseDto,
} from './dto/diary-response.dto';

@ApiTags('diary')
@ApiBearerAuth()
@Controller('diary')
export class DiaryController {
  constructor(
    private readonly createEntry: CreateDiaryEntryUseCase,
    private readonly listEntries: ListDiaryEntriesUseCase,
    private readonly getGamification: GetGamificationUseCase,
    private readonly assist: AssistDiaryUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a diary entry; returns the gamification delta.' })
  @ApiResponse({ status: 201, type: CreateDiaryEntryResponseDto })
  @ApiResponse({ status: 422, description: 'INVALID_DIARY_* validation codes.' })
  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateDiaryEntryBodySchema)) body: CreateDiaryEntryBody,
  ) {
    return this.createEntry.execute({
      userId: user.sub,
      title: body.title,
      body: body.body,
      ...(body.tripId ? { tripId: body.tripId } : {}),
      ...(body.mood ? { mood: body.mood } : {}),
      ...(body.aiAssisted !== undefined ? { aiAssisted: body.aiAssisted } : {}),
      ...(body.entryDate ? { entryDate: body.entryDate } : {}),
    });
  }

  @ApiOperation({ summary: 'List the caller’s diary entries (newest first).' })
  @ApiResponse({ status: 200, type: ListDiaryEntriesResponseDto })
  @Get('entries')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tripId') tripId?: string,
    @Query('limit') limit?: string,
  ) {
    const entries = await this.listEntries.execute({
      userId: user.sub,
      ...(tripId ? { tripId } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
    return { entries };
  }

  @ApiOperation({ summary: 'Points, streaks + the full badge shelf (earned + locked).' })
  @ApiResponse({ status: 200, type: GamificationViewDto })
  @Get('gamification')
  gamification(@CurrentUser() user: AuthenticatedUser) {
    return this.getGamification.execute(user.sub);
  }

  @ApiOperation({ summary: 'AI writing assist: prompt | polish | title.' })
  @ApiResponse({ status: 200, type: AssistDiaryResponseDto })
  @ApiResponse({ status: 422, description: 'DIARY_ASSIST_NEEDS_TEXT.' })
  @Post('assist')
  @HttpCode(HttpStatus.OK)
  assistEntry(
    @CurrentUser() _user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AssistDiaryBodySchema)) body: AssistDiaryBody,
  ) {
    return this.assist.execute({
      mode: body.mode,
      ...(body.text ? { text: body.text } : {}),
      ...(body.mood ? { mood: body.mood } : {}),
      ...(body.place ? { place: body.place } : {}),
    });
  }
}
