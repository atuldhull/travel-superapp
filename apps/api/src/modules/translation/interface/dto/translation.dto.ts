/**
 * V.UX.18 — Zod + class-based DTOs for the translation surface.
 *
 * Installed by prompt [V.UX.18].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const TranslateTextBodySchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  targetLang: z.string().trim().min(1).max(16),
  sourceLang: z.string().trim().min(1).max(16).optional(),
});
export type TranslateTextBody = z.infer<typeof TranslateTextBodySchema>;

export class TranslateTextRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 10_000 })
  declare text: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 16,
    description: 'BCP-47 target language tag (e.g. "en", "fr", "ja", "zh-Hans-CN").',
  })
  declare targetLang: string;

  @ApiProperty({
    required: false,
    minLength: 1,
    maxLength: 16,
    description: 'Optional source language tag. Provider auto-detects when omitted.',
  })
  declare sourceLang?: string;
}

export class TranslationDto {
  @ApiProperty()
  declare sourceText: string;

  @ApiProperty()
  declare translatedText: string;

  @ApiProperty({ nullable: true, description: 'BCP-47 detected or supplied source language.' })
  declare sourceLang: string | null;

  @ApiProperty()
  declare targetLang: string;

  @ApiProperty({ description: 'Underlying provider id (e.g. "stub", "google").' })
  declare provider: string;
}
