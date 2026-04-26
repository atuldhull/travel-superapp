/**
 * Class-based response DTOs for the Safety / scam-reports HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.59].
 */
import { ApiProperty } from '@nestjs/swagger';

export class CoordinatesDto {
  @ApiProperty({ description: 'Latitude in decimal degrees, -90..90.' })
  declare lat: number;

  @ApiProperty({ description: 'Longitude in decimal degrees, -180..180.' })
  declare lng: number;
}

export class ReportScamRequestDto {
  @ApiProperty({ description: 'Scam category slug (e.g. "taxi-overcharge", "fake-temple").' })
  declare category: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  declare severity: string;

  @ApiProperty({ type: CoordinatesDto, description: 'Where the scam was witnessed.' })
  declare center: CoordinatesDto;

  @ApiProperty({ description: 'Free-form prose description of the scam.' })
  declare description: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Optional URLs of evidence (photos uploaded to media bucket).',
  })
  declare evidenceUrls?: string[];
}

export class FindNearbyScamsRequestDto {
  @ApiProperty({ type: CoordinatesDto })
  declare center: CoordinatesDto;

  @ApiProperty({ description: 'Search radius in kilometers.' })
  declare radiusKm: number;

  @ApiProperty({ required: false, description: 'Filter by category slug.' })
  declare category?: string;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high', 'critical'] })
  declare minSeverity?: string;

  @ApiProperty({ required: false, description: 'Only return verified reports.' })
  declare verifiedOnly?: boolean;

  @ApiProperty({ required: false, description: 'Cap on result count (default 50).' })
  declare limit?: number;
}

export class ScamReportDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare reporterId: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  declare severity: string;

  @ApiProperty()
  declare description: string;

  @ApiProperty({ type: [String] })
  declare evidenceUrls: string[];

  @ApiProperty()
  declare verified: boolean;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ScamReportWithDistanceDto extends ScamReportDto {
  @ApiProperty({ description: 'Distance in meters from the search center.' })
  declare distanceMeters: number;
}

export class FindNearbyScamsResponseDto {
  @ApiProperty({
    type: [ScamReportWithDistanceDto],
    description: 'Matching reports, nearest-first.',
  })
  declare reports: ScamReportWithDistanceDto[];
}
