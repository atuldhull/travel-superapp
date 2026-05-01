/**
 * V.UX.24 — Zod schemas + class-based response DTOs for the
 * caller-self agent surfaces:
 *
 *   GET   /agent/me                     → AgentProfileDto
 *   PATCH /agent/me                     → AgentProfileDto
 *   GET   /agent/me/dashboard?windowDays=
 *                                       → AgentDashboardDto
 *
 * Installed by prompt [V.UX.24].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const UpdateAgentProfileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  languages: z.array(z.string().trim().min(2).max(40)).max(20).optional(),
  regions: z.array(z.string().trim().min(2).max(40)).max(20).optional(),
});
export type UpdateAgentProfileBody = z.infer<typeof UpdateAgentProfileBodySchema>;

export const DashboardQuerySchema = z.object({
  windowDays: z.coerce.number().int().positive().max(365).optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export class UpdateAgentProfileRequestDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 120 })
  declare displayName?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    maxLength: 2000,
    description: 'null clears the bio.',
  })
  declare bio?: string | null;

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  declare languages?: string[];

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  declare regions?: string[];
}

export class AgentProfileDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare displayName: string;

  @ApiProperty({ nullable: true })
  declare bio: string | null;

  @ApiProperty({ enum: ['pending', 'verified', 'rejected'] })
  declare kycStatus: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare verifiedAt: string | null;

  @ApiProperty({ type: [String] })
  declare languages: string[];

  @ApiProperty({ type: [String] })
  declare regions: string[];

  @ApiProperty()
  declare ratingAverage: number;

  @ApiProperty()
  declare ratingCount: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class AgentBookingSummaryDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({ description: '2-decimal USD string.' })
  declare amountUsd: string;

  @ApiProperty()
  declare currency: string;

  @ApiProperty({ enum: ['held', 'released', 'refunded', 'disputed'] })
  declare state: string;

  @ApiProperty({ format: 'date-time' })
  declare heldAt: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare releasedAt: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare refundedAt: string | null;
}

export class AgentEarningsSummaryDto {
  @ApiProperty({ description: '2-decimal USD gross.' })
  declare grossUsd: string;

  @ApiProperty()
  declare bookingsCount: number;
}

export class AgentReviewWithResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare authorId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  declare rating: number;

  @ApiProperty()
  declare body: string;

  @ApiProperty()
  declare language: string;

  @ApiProperty()
  declare verifiedBooking: boolean;

  @ApiProperty({ nullable: true })
  declare responseBody: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare responseAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class AgentDashboardDto {
  @ApiProperty({ type: AgentProfileDto })
  declare profile: AgentProfileDto;

  @ApiProperty({ type: [AgentBookingSummaryDto] })
  declare bookings: AgentBookingSummaryDto[];

  @ApiProperty({ type: AgentEarningsSummaryDto })
  declare earnings: AgentEarningsSummaryDto;

  @ApiProperty({ type: [AgentReviewWithResponseDto] })
  declare reviews: AgentReviewWithResponseDto[];

  @ApiProperty({ description: 'Lookback window applied (1..365).' })
  declare windowDays: number;
}
