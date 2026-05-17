/**
 * Class-based response DTOs for `POST /transport/navigation`.
 * Documentation-only (Swagger / generated SDK shape).
 *
 * Installed for the live-navigation feature.
 */
import { ApiProperty } from '@nestjs/swagger';

const FLAVORS = ['fastest', 'scenic', 'avoid_traffic'] as const;
const TRAFFIC_LEVELS = ['free', 'moderate', 'heavy', 'blocked'] as const;
const ADVISORY_KINDS = ['blockage', 'heavy_traffic', 'reroute', 'scenic_tip'] as const;

export class NavCoordinatesDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class GetNavigationRequestDto {
  @ApiProperty({ type: NavCoordinatesDto })
  declare origin: NavCoordinatesDto;

  @ApiProperty({ type: NavCoordinatesDto })
  declare destination: NavCoordinatesDto;

  @ApiProperty({
    required: false,
    type: [NavCoordinatesDto],
    description: 'Intermediate stops in visiting order (≤ 8).',
  })
  declare waypoints?: NavCoordinatesDto[];
}

export class NavPointDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;
}

export class TrafficSegmentDto {
  @ApiProperty({ description: 'Inclusive start index into the route geometry.' })
  declare fromIndex: number;

  @ApiProperty({ description: 'Inclusive end index into the route geometry.' })
  declare toIndex: number;

  @ApiProperty({ enum: TRAFFIC_LEVELS })
  declare level: string;
}

export class NavAdvisoryDto {
  @ApiProperty({ enum: ADVISORY_KINDS })
  declare kind: string;

  @ApiProperty()
  declare message: string;

  @ApiProperty({ required: false, nullable: true })
  declare atLat?: number;

  @ApiProperty({ required: false, nullable: true })
  declare atLng?: number;
}

export class NavRouteDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty({ enum: FLAVORS })
  declare flavor: string;

  @ApiProperty()
  declare label: string;

  @ApiProperty()
  declare distanceMeters: number;

  @ApiProperty()
  declare durationSeconds: number;

  @ApiProperty({ description: 'ETA adjusted for traffic; == durationSeconds when no data.' })
  declare durationInTrafficSeconds: number;

  @ApiProperty({ type: [NavPointDto] })
  declare geometry: NavPointDto[];

  @ApiProperty({ type: [TrafficSegmentDto] })
  declare trafficSegments: TrafficSegmentDto[];

  @ApiProperty({ type: [NavAdvisoryDto] })
  declare advisories: NavAdvisoryDto[];

  @ApiProperty({ enum: ['live', 'mock', 'none'] })
  declare trafficSource: string;
}

export class GetNavigationResponseDto {
  @ApiProperty({ type: [NavRouteDto], description: 'Fastest + scenic + avoid-traffic options.' })
  declare routes: NavRouteDto[];

  @ApiProperty({ description: 'Id of the route to recommend right now.' })
  declare recommendedRouteId: string;

  @ApiProperty({ enum: ['osrm', 'mock'] })
  declare routeSource: string;
}
