/**
 * Class-based response DTOs for the Transport HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.65].
 */
import { ApiProperty } from '@nestjs/swagger';

const TRANSPORT_MODES = [
  'walk',
  'public_transit',
  'bicycle',
  'two_wheeler',
  'car',
  'taxi',
  'rideshare',
] as const;

export class TransportCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class GetRoutesRequestDto {
  @ApiProperty({ type: TransportCoordinatesDto })
  declare origin: TransportCoordinatesDto;

  @ApiProperty({ type: TransportCoordinatesDto })
  declare destination: TransportCoordinatesDto;

  @ApiProperty({
    required: false,
    type: [String],
    enum: TRANSPORT_MODES,
    description: 'Filter to a subset of modes; empty/omitted means all available.',
  })
  declare modes?: string[];
}

export class RouteLegDto {
  @ApiProperty({ enum: TRANSPORT_MODES })
  declare mode: string;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty()
  declare durationSeconds: number;

  @ApiProperty({
    nullable: true,
    description: 'Flat USD estimate (null for walk; transit/car/etc populated by provider).',
  })
  declare estimatedCostUsd: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low'] })
  declare confidence: string;
}

export class GetRoutesResponseDto {
  @ApiProperty({ type: [RouteLegDto], description: 'One leg per available mode.' })
  declare routes: RouteLegDto[];
}
