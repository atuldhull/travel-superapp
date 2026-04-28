/**
 * V.UX.13 — Zod schemas + class-based response DTOs for the
 * trusted-contact CRUD surface.
 *
 * Installed by prompt [V.UX.13].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const AddTrustedContactBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(3).max(40).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
});
export type AddTrustedContactBody = z.infer<typeof AddTrustedContactBodySchema>;

export class AddTrustedContactRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  declare name: string;

  @ApiProperty({ required: false, nullable: true, minLength: 3, maxLength: 40 })
  declare phone?: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'email', maxLength: 254 })
  declare email?: string | null;
}

export class TrustedContactDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({ maxLength: 80 })
  declare name: string;

  @ApiProperty({ nullable: true, maxLength: 40 })
  declare phone: string | null;

  @ApiProperty({ nullable: true, format: 'email', maxLength: 254 })
  declare email: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ListTrustedContactsResponseDto {
  @ApiProperty({
    type: [TrustedContactDto],
    description: "Caller's pre-set safety contacts. At most 3 per account.",
  })
  declare contacts: TrustedContactDto[];
}
