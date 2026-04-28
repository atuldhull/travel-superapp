/**
 * V.UX.18 — translate one snippet of text via the configured
 * provider. Validation: text is bounded (1..10_000 chars), target
 * language tag is a non-empty string capped at 16 chars (BCP-47
 * tags are always shorter, e.g. `en-GB`, `zh-Hans-CN`).
 *
 * Installed by prompt [V.UX.18].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { Translation } from '../domain/translation.entity';
import { TRANSLATOR_PORT, type Translator } from './ports/translator.port';

const MAX_TEXT_LENGTH = 10_000;
const MAX_LANG_LENGTH = 16;

export interface TranslateTextCommand {
  readonly text: string;
  readonly targetLang: string;
  readonly sourceLang?: string;
}

@Injectable()
export class TranslateTextUseCase {
  constructor(@Inject(TRANSLATOR_PORT) private readonly translator: Translator) {}

  async execute(cmd: TranslateTextCommand): Promise<Translation> {
    const text = cmd.text.trim();
    if (text.length === 0) {
      throw new ValidationError(
        'Text must be non-empty',
        { text: ['must be 1..10000 chars'] },
        { length: 0 },
        'INVALID_TEXT',
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new ValidationError(
        `Text too long (max ${MAX_TEXT_LENGTH} chars)`,
        { text: [`must be ≤ ${MAX_TEXT_LENGTH} chars`] },
        { length: text.length, max: MAX_TEXT_LENGTH },
        'INVALID_TEXT',
      );
    }
    const target = cmd.targetLang.trim();
    if (target.length === 0 || target.length > MAX_LANG_LENGTH) {
      throw new ValidationError(
        `Target language must be 1..${MAX_LANG_LENGTH} chars`,
        { targetLang: [`must be 1..${MAX_LANG_LENGTH}`] },
        { targetLang: cmd.targetLang },
        'INVALID_TARGET_LANG',
      );
    }
    const source = cmd.sourceLang?.trim();
    if (source !== undefined && source.length > MAX_LANG_LENGTH) {
      throw new ValidationError(
        `Source language must be 1..${MAX_LANG_LENGTH} chars`,
        { sourceLang: [`must be 1..${MAX_LANG_LENGTH}`] },
        { sourceLang: cmd.sourceLang },
        'INVALID_SOURCE_LANG',
      );
    }
    return this.translator.translate({
      text,
      targetLang: target,
      ...(source && source.length > 0 ? { sourceLang: source } : {}),
    });
  }
}
