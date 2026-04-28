/**
 * V.UX.18 — translation feature module.
 *
 *   controller (interface)
 *     → TranslateTextUseCase (application)
 *       → TRANSLATOR_PORT (port)
 *         ← StubTranslatorAdapter (infrastructure)
 *
 * v1 ships only the stub. Real adapters (Google Cloud Translate,
 * DeepL) land as sibling classes that implement the same port; the
 * `useFactory` provider would pick one based on env (GOOGLE_TRANSLATE_KEY,
 * DEEPL_API_KEY) — same pattern as TRIP_PLANNER_PORT.
 *
 * Installed by prompt [V.UX.18].
 */
import { Module } from '@nestjs/common';
import { TranslateTextUseCase } from './application/translate-text.use-case';
import { TRANSLATOR_PORT } from './application/ports/translator.port';
import { StubTranslatorAdapter } from './infrastructure/stub-translator.adapter';
import { TranslationController } from './interface/translation.controller';

@Module({
  controllers: [TranslationController],
  providers: [{ provide: TRANSLATOR_PORT, useClass: StubTranslatorAdapter }, TranslateTextUseCase],
})
export class TranslationModule {}
