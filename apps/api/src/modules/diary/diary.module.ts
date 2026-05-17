/**
 * Adventure Diary module (user-directed feature). Clean-hex:
 *
 *   controller (interface)
 *     → CreateDiaryEntryUseCase → DIARY_REPOSITORY + GAMIFICATION_REPOSITORY
 *     → ListDiaryEntriesUseCase → DIARY_REPOSITORY
 *     → GetGamificationUseCase  → GAMIFICATION_REPOSITORY
 *     → AssistDiaryUseCase      → DIARY_AI_ASSISTANT
 *
 * Gamification points/streak/badge rules live PURE in
 * domain/gamification.ts. The AI assistant is bound to the
 * deterministic heuristic adapter ($0, offline, test-safe); the port
 * lets an LLM adapter replace it later env-gated, same upgrade
 * pattern as the trip-planner chain. DbModule is @Global so
 * PrismaService needs no explicit import.
 *
 * Installed for the adventure-diary feature.
 */
import { Module } from '@nestjs/common';
import { CreateDiaryEntryUseCase } from './application/create-diary-entry.use-case';
import { ListDiaryEntriesUseCase } from './application/list-diary-entries.use-case';
import { GetGamificationUseCase } from './application/get-gamification.use-case';
import { AssistDiaryUseCase } from './application/assist-diary.use-case';
import { DIARY_REPOSITORY } from './application/ports/diary.repository';
import { GAMIFICATION_REPOSITORY } from './application/ports/gamification.repository';
import { DIARY_AI_ASSISTANT } from './application/ports/diary-ai-assistant.port';
import { PrismaDiaryRepository } from './infrastructure/prisma-diary.repository';
import { PrismaGamificationRepository } from './infrastructure/prisma-gamification.repository';
import { HeuristicDiaryAssistant } from './infrastructure/heuristic-diary-assistant';
import { DiaryController } from './interface/diary.controller';

@Module({
  controllers: [DiaryController],
  providers: [
    { provide: DIARY_REPOSITORY, useClass: PrismaDiaryRepository },
    { provide: GAMIFICATION_REPOSITORY, useClass: PrismaGamificationRepository },
    { provide: DIARY_AI_ASSISTANT, useClass: HeuristicDiaryAssistant },
    CreateDiaryEntryUseCase,
    ListDiaryEntriesUseCase,
    GetGamificationUseCase,
    AssistDiaryUseCase,
  ],
  exports: [CreateDiaryEntryUseCase, GetGamificationUseCase],
})
export class DiaryModule {}
