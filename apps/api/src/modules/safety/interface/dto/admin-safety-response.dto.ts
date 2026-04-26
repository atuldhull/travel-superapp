/**
 * Class-based response DTOs for admin-side safety surfaces
 * (scam moderation + SOS triage). Documentation-only.
 *
 * Installed by prompt [IV.18.19.70].
 */
import { ApiProperty } from '@nestjs/swagger';
import { ScamReportDto } from './safety-response.dto';
import { SosEventDto } from './safety-subs-response.dto';

export class AdminListScamReportsResponseDto {
  @ApiProperty({ type: [ScamReportDto] })
  declare reports: ScamReportDto[];
}

export class AdminListSosEventsResponseDto {
  @ApiProperty({ type: [SosEventDto] })
  declare events: SosEventDto[];

  @ApiProperty()
  declare total: number;
}

export class AdminResolveSosRequestDto {
  @ApiProperty({ required: false, nullable: true, description: 'Optional admin resolution note.' })
  declare note?: string | null;
}
