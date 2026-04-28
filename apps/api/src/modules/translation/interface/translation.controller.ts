/**
 * V.UX.18 — translation HTTP surface.
 *
 *   POST /api/v1/translation/translate
 *     body: { text, targetLang, sourceLang? }
 *     200  → TranslationDto
 *     422  → INVALID_TEXT | INVALID_TARGET_LANG | INVALID_SOURCE_LANG
 *
 * Authenticated so the rate-limit guard can key on user — the
 * translation provider has paid quotas and we don't want a
 * single anonymous client to drain them.
 *
 * Installed by prompt [V.UX.18].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TranslateTextUseCase } from '../application/translate-text.use-case';
import type { Translation } from '../domain/translation.entity';
import {
  TranslateTextBodySchema,
  TranslateTextRequestDto,
  TranslationDto,
  type TranslateTextBody,
} from './dto/translation.dto';

interface TranslationOutDto {
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sourceLang: string | null;
  readonly targetLang: string;
  readonly provider: string;
}

function toDto(t: Translation): TranslationOutDto {
  return {
    sourceText: t.sourceText,
    translatedText: t.translatedText,
    sourceLang: t.sourceLang,
    targetLang: t.targetLang,
    provider: t.provider,
  };
}

@ApiTags('translation')
@ApiBearerAuth()
@Controller('translation')
export class TranslationController {
  constructor(private readonly translateUc: TranslateTextUseCase) {}

  @ApiOperation({
    summary: 'Translate a snippet of text. v1 ships a stub provider — real providers swap later.',
  })
  @ApiBody({ type: TranslateTextRequestDto })
  @ApiResponse({ status: 200, description: 'Translated text + provenance.', type: TranslationDto })
  @ApiResponse({
    status: 422,
    description: 'INVALID_TEXT | INVALID_TARGET_LANG | INVALID_SOURCE_LANG.',
  })
  @Post('translate')
  @HttpCode(HttpStatus.OK)
  async translate(
    @Body(new ZodValidationPipe(TranslateTextBodySchema)) body: TranslateTextBody,
  ): Promise<TranslationOutDto> {
    const out = await this.translateUc.execute({
      text: body.text,
      targetLang: body.targetLang,
      ...(body.sourceLang !== undefined ? { sourceLang: body.sourceLang } : {}),
    });
    return toDto(out);
  }
}
