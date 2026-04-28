/**
 * V.UX.14 — Zod schema + class-based DTOs for the preferences
 * surface. Every field on the PATCH body is optional; an empty body
 * is a no-op upsert.
 *
 * Installed by prompt [V.UX.14].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const UpdatePreferencesBodySchema = z.object({
  diet: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  accessibility: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  travelType: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  budgetTier: z.number().int().min(1).max(5).optional(),
  familyMode: z.boolean().optional(),
  kidAges: z.array(z.number().int().min(0).max(17)).max(8).optional(),
  comfortMode: z.boolean().optional(),
});
export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesBodySchema>;

export class UpdatePreferencesRequestDto {
  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  declare diet?: string[];

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  declare accessibility?: string[];

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  declare travelType?: string[];

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  declare budgetTier?: number;

  @ApiProperty({
    required: false,
    description: 'V.UX.14 — flips search forms into family-aware mode.',
  })
  declare familyMode?: boolean;

  @ApiProperty({
    required: false,
    type: [Number],
    maxItems: 8,
    description: 'Ages of any travelling children, each 0..17.',
  })
  declare kidAges?: number[];

  @ApiProperty({
    required: false,
    description: 'V.UX.15 — accessibility/senior comfort mode (larger fonts, step-free routing).',
  })
  declare comfortMode?: boolean;
}

export class PreferencesDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({ type: [String] })
  declare diet: string[];

  @ApiProperty({ type: [String] })
  declare accessibility: string[];

  @ApiProperty({ type: [String] })
  declare travelType: string[];

  @ApiProperty({ minimum: 1, maximum: 5 })
  declare budgetTier: number;

  @ApiProperty({ description: 'V.UX.14 — family-mode toggle.' })
  declare familyMode: boolean;

  @ApiProperty({ type: [Number], maxItems: 8 })
  declare kidAges: number[];

  @ApiProperty({ description: 'V.UX.15 — accessibility comfort-mode toggle.' })
  declare comfortMode: boolean;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}
