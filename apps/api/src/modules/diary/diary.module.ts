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
 * domain/gamification.ts. The AI assistant is the CompositeDiary
 * Assistant: real LLM when configured (Gemini free tier → Ollama
 * local $0, precedence at boot) else the deterministic heuristic —
 * and it always falls back to the heuristic on any LLM failure, so
 * the feature is "real AI when available, always-works otherwise".
 * Same env-gated optional-provider pattern as the trip-planner chain.
 * DbModule is @Global so PrismaService needs no explicit import.
 *
 * Installed for the adventure-diary feature.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
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
import { LlmDiaryAssistant } from './infrastructure/llm-diary-assistant';
import { CompositeDiaryAssistant } from './infrastructure/composite-diary-assistant';
import { DiaryController } from './interface/diary.controller';

@Module({
  controllers: [DiaryController],
  providers: [
    { provide: DIARY_REPOSITORY, useClass: PrismaDiaryRepository },
    { provide: GAMIFICATION_REPOSITORY, useClass: PrismaGamificationRepository },
    HeuristicDiaryAssistant,
    {
      // Env-gated LLM: Gemini free tier → Ollama local $0. Null when
      // neither is configured — composite then always uses the
      // heuristic. Conditional ctor (key/URL) → built in a factory,
      // never in providers[] (Nest would eagerly instantiate it).
      provide: LlmDiaryAssistant,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const geminiKey = config.get('GEMINI_API_KEY', { infer: true });
        if (geminiKey) {
          return new LlmDiaryAssistant({
            provider: 'gemini',
            model: config.get('GEMINI_MODEL', { infer: true }),
            credential: geminiKey,
          });
        }
        const ollamaUrl = config.get('OLLAMA_URL', { infer: true });
        if (ollamaUrl) {
          return new LlmDiaryAssistant({
            provider: 'ollama',
            model: config.get('OLLAMA_MODEL', { infer: true }),
            credential: ollamaUrl,
          });
        }
        return null;
      },
    },
    {
      provide: DIARY_AI_ASSISTANT,
      inject: [HeuristicDiaryAssistant, LlmDiaryAssistant],
      useFactory: (heuristic: HeuristicDiaryAssistant, llm: LlmDiaryAssistant | null) =>
        new CompositeDiaryAssistant(heuristic, llm),
    },
    CreateDiaryEntryUseCase,
    ListDiaryEntriesUseCase,
    GetGamificationUseCase,
    AssistDiaryUseCase,
  ],
  exports: [CreateDiaryEntryUseCase, GetGamificationUseCase],
})
export class DiaryModule {}
