/**
 * V.UX.17 — Zod + class-based DTOs for the concierge / agent-match
 * surface.
 *
 * Installed by prompt [V.UX.17].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const MatchAgentForTripBodySchema = z.object({
  tripId: z.string().trim().min(1).max(64),
  region: z.string().trim().min(1).max(80).optional(),
});
export type MatchAgentForTripBody = z.infer<typeof MatchAgentForTripBodySchema>;

export class MatchAgentForTripRequestDto {
  @ApiProperty({ format: 'cuid', description: 'Caller-owned trip id.' })
  declare tripId: string;

  @ApiProperty({
    required: false,
    minLength: 1,
    maxLength: 80,
    description:
      'Destination region token (e.g. "France", "Bali"). Case-sensitive exact match against any Agent.regions entry. Omit to match top-rated verified agents globally.',
  })
  declare region?: string;
}

export class AgentMatchDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ maxLength: 120 })
  declare displayName: string;

  @ApiProperty({ nullable: true })
  declare bio: string | null;

  @ApiProperty({ type: [String] })
  declare languages: string[];

  @ApiProperty({ type: [String] })
  declare regions: string[];

  @ApiProperty({ description: '0..5 rounded to 1 decimal.' })
  declare ratingAverage: number;

  @ApiProperty()
  declare ratingCount: number;

  @ApiProperty({ format: 'date-time' })
  declare verifiedAt: string;
}

export class MatchAgentForTripResponseDto {
  @ApiProperty({
    type: [AgentMatchDto],
    description:
      'Up to 3 verified agents, ordered by ratingAverage DESC, ratingCount DESC, verifiedAt DESC. Empty array is valid (no matches for this region yet).',
  })
  declare matches: AgentMatchDto[];
}
