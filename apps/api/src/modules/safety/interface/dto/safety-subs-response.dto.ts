/**
 * Class-based response DTOs for the Safety sub-controllers
 * (sos, crime-layer, safety-score). Documentation-only.
 *
 * Installed by prompt [IV.18.19.69].
 */
import { ApiProperty } from '@nestjs/swagger';
import { CoordinatesDto } from './safety-response.dto';

// ─── SOS ─────────────────────────────────────────────────────────

export class TriggerSosRequestDto {
  @ApiProperty({ enum: ['panic', 'medical', 'theft', 'lost', 'other'] })
  declare trigger: string;

  @ApiProperty({ type: CoordinatesDto })
  declare center: CoordinatesDto;
}

export class ResolveSosRequestDto {
  @ApiProperty({ required: false, nullable: true, description: 'Free-form note (max 500 chars).' })
  declare note?: string | null;
}

export class SosEventDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({ enum: ['panic', 'medical', 'theft', 'lost', 'other'] })
  declare trigger: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare resolvedAt: string | null;

  @ApiProperty({ nullable: true })
  declare resolutionNote: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ListSosEventsResponseDto {
  @ApiProperty({ type: [SosEventDto] })
  declare events: SosEventDto[];
}

// ─── Crime layer ─────────────────────────────────────────────────

export class FindNearbyCrimesRequestDto {
  @ApiProperty({ type: CoordinatesDto })
  declare center: CoordinatesDto;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ required: false })
  declare category?: string;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high', 'critical'] })
  declare minSeverity?: string;

  @ApiProperty({
    required: false,
    description: 'Restrict to incidents reported in the last N days.',
  })
  declare sinceDays?: number;

  @ApiProperty({ required: false })
  declare limit?: number;
}

export class CrimeIncidentDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'Source feed key.' })
  declare source: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  declare severity: string;

  @ApiProperty({ format: 'date-time' })
  declare reportedAt: string;

  @ApiProperty()
  declare distanceMeters: number;
}

export class FindNearbyCrimesResponseDto {
  @ApiProperty({ type: [CrimeIncidentDto] })
  declare incidents: CrimeIncidentDto[];
}

// ─── Composite safety score ──────────────────────────────────────

export class SafetyScoreRequestDto {
  @ApiProperty({ type: CoordinatesDto })
  declare center: CoordinatesDto;

  @ApiProperty({
    required: false,
    description: 'Search radius in km (default depends on use-case).',
  })
  declare radiusKm?: number;
}

export class SafetyScoreBreakdownDto {
  @ApiProperty()
  declare crimes: number;

  @ApiProperty()
  declare scams: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Crime counts bucketed by severity.',
  })
  declare byCrimeSeverity: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Scam counts bucketed by severity.',
  })
  declare byScamSeverity: Record<string, number>;
}

export class SafetyScoreResponseDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty()
  declare radiusKm: number;

  @ApiProperty({ description: 'Composite score 0..100 (higher = safer).' })
  declare score: number;

  @ApiProperty({ enum: ['A', 'B', 'C', 'D', 'F'], description: 'Letter grade derived from score.' })
  declare grade: string;

  @ApiProperty({ type: SafetyScoreBreakdownDto })
  declare breakdown: SafetyScoreBreakdownDto;

  @ApiProperty({ format: 'date-time' })
  declare computedAt: string;
}
