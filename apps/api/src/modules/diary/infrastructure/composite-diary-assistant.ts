/**
 * Diary assistant that prefers the real LLM when one is configured
 * and falls back to the deterministic heuristic on ANY failure
 * (timeout, non-OK, empty, no key) — so the feature is "real AI when
 * available, always-works otherwise". In `NODE_ENV==='test'` the LLM
 * is skipped entirely so e2e specs stay deterministic + offline.
 *
 * Mirrors the env-gated optional-provider pattern used across the
 * codebase (payments / observability / live-traffic).
 *
 * Installed for the adventure-diary feature (real-LLM upgrade).
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type {
  DiaryAiAssistant,
  DiaryAssistInput,
  DiaryAssistResult,
} from '../application/ports/diary-ai-assistant.port';
import { HeuristicDiaryAssistant } from './heuristic-diary-assistant';
import { LlmDiaryAssistant } from './llm-diary-assistant';

@Injectable()
export class CompositeDiaryAssistant implements DiaryAiAssistant {
  private readonly logger: AppLogger = createLogger('diary.assistant.composite');

  constructor(
    private readonly heuristic: HeuristicDiaryAssistant,
    private readonly llm: LlmDiaryAssistant | null = null,
  ) {}

  async assist(input: DiaryAssistInput): Promise<DiaryAssistResult> {
    if (!this.llm || process.env['NODE_ENV'] === 'test') {
      return this.heuristic.assist(input);
    }
    try {
      return await this.llm.assist(input);
    } catch {
      // LlmDiaryAssistant already logged the cause at warn.
      this.logger.warn({ mode: input.mode }, 'diary_assist_fallback_to_heuristic');
      return this.heuristic.assist(input);
    }
  }
}
