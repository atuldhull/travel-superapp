/**
 * V.UX.18 — stub translator. Prefixes input with the target
 * language tag in brackets so the end-to-end flow demonstrates
 * the full request/response shape without any paid keys. Real
 * Google / DeepL adapters land via the same port.
 *
 * Installed by prompt [V.UX.18].
 */
import { Injectable } from '@nestjs/common';
import type { Translation } from '../domain/translation.entity';
import type { TranslateInput, Translator } from '../application/ports/translator.port';

@Injectable()
export class StubTranslatorAdapter implements Translator {
  async translate(input: TranslateInput): Promise<Translation> {
    const target = input.targetLang.trim().toLowerCase();
    const source = input.sourceLang?.trim().toLowerCase() ?? null;
    return {
      sourceText: input.text,
      translatedText: `[stub:${target}] ${input.text}`,
      sourceLang: source,
      targetLang: target,
      provider: 'stub',
    };
  }
}
