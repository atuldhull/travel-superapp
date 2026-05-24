/**
 * Get mode-fit route options between two coordinates. Business
 * logic is input validation + clamping; caching lives in the
 * decorator.
 *
 * Distance cap: 500km straight-line (via haversine). Beyond that
 * it's inter-city / regional routing, which is a separate product
 * concern (different cost models, different providers). Caps at the
 * use-case layer so the mock + any future real adapter doesn't
 * waste effort on obviously-out-of-scope queries.
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import { haversineKm } from '../../../common/geo/haversine';
import type { RouteLeg, TransportMode } from '../domain/route-leg.entity';
import { ROUTING_PROVIDER, type RoutingProvider } from './ports/routing-provider';

const MAX_STRAIGHT_LINE_KM = 500;
// [J2] EARTH_RADIUS_KM constant + haversineKm() implementation
// extracted to apps/api/src/common/geo/haversine.ts. The straight-
// line cap below now goes through the shared helper.

export interface GetRoutesCommand {
  readonly origin: { readonly lat: number; readonly lng: number };
  readonly destination: { readonly lat: number; readonly lng: number };
  readonly modes?: readonly TransportMode[];
  /**
   * V.UX.15 — accessibility / senior persona. When true the
   * provider returns only step-free legs. Default false.
   */
  readonly stepFreeOnly?: boolean;
}

@Injectable()
export class GetRoutesUseCase {
  constructor(@Inject(ROUTING_PROVIDER) private readonly provider: RoutingProvider) {}

  async execute(cmd: GetRoutesCommand): Promise<readonly RouteLeg[]> {
    assertCoord('origin.lat', cmd.origin.lat, -90, 90);
    assertCoord('origin.lng', cmd.origin.lng, -180, 180);
    assertCoord('destination.lat', cmd.destination.lat, -90, 90);
    assertCoord('destination.lng', cmd.destination.lng, -180, 180);

    if (cmd.origin.lat === cmd.destination.lat && cmd.origin.lng === cmd.destination.lng) {
      throw new ValidationError(
        'Origin and destination must differ',
        { destination: ['must differ from origin'] },
        { origin: cmd.origin, destination: cmd.destination },
        'SAME_ORIGIN_DESTINATION',
      );
    }

    const straightLineKm = haversineKm(cmd.origin, cmd.destination);
    if (straightLineKm > MAX_STRAIGHT_LINE_KM) {
      throw new ValidationError(
        `Route too long (${Math.round(straightLineKm)}km straight-line; max ${MAX_STRAIGHT_LINE_KM}km)`,
        { destination: [`must be within ${MAX_STRAIGHT_LINE_KM}km of origin`] },
        { straightLineKm: Math.round(straightLineKm), max: MAX_STRAIGHT_LINE_KM },
        'ROUTE_TOO_LONG',
      );
    }

    return this.provider.getRoutes({
      originLat: cmd.origin.lat,
      originLng: cmd.origin.lng,
      destinationLat: cmd.destination.lat,
      destinationLng: cmd.destination.lng,
      ...(cmd.modes && cmd.modes.length > 0 ? { modes: cmd.modes } : {}),
      ...(cmd.stepFreeOnly === true ? { stepFreeOnly: true } : {}),
    });
  }
}

function assertCoord(field: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(
      `${field} out of range`,
      { [field]: [`must be between ${min} and ${max}`] },
      { [field]: value },
      'INVALID_COORDINATES',
    );
  }
}

// [J2] haversineKm() lives in common/geo/haversine.ts.
