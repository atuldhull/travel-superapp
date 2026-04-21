/**
 * Federated search: ask the external `PlaceProvider` for candidates
 * near a coord + radius. Intentionally does NOT merge with the local
 * catalog — that's a follow-up slice (write-through + dedup by
 * `(provider, externalId)`).
 *
 * Business logic is input validation + clamping; caching lives in
 * the decorator (`CachedPlaceProvider`) so the use-case stays
 * stateless.
 *
 * Installed by prompt [IV.18.4.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { InvalidRadiusError, ValidationError } from '@app/errors';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import { PLACE_PROVIDER, type PlaceProvider } from './ports/place-provider';

const MAX_RADIUS_KM = 50;

export interface FederatedSearchPlacesCommand {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly category?: string;
}

@Injectable()
export class FederatedSearchPlacesUseCase {
  constructor(@Inject(PLACE_PROVIDER) private readonly provider: PlaceProvider) {}

  async execute(cmd: FederatedSearchPlacesCommand): Promise<readonly FederatedPlaceResult[]> {
    if (
      !Number.isFinite(cmd.center.lat) ||
      cmd.center.lat < -90 ||
      cmd.center.lat > 90 ||
      !Number.isFinite(cmd.center.lng) ||
      cmd.center.lng < -180 ||
      cmd.center.lng > 180
    ) {
      throw new ValidationError(
        'Coordinates out of range',
        { lat: ['-90..90'], lng: ['-180..180'] },
        { lat: cmd.center.lat, lng: cmd.center.lng },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be positive',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_RADIUS_KM) {
      throw new InvalidRadiusError(cmd.radiusKm, MAX_RADIUS_KM);
    }

    return this.provider.search({
      lat: cmd.center.lat,
      lng: cmd.center.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.category ? { category: cmd.category } : {}),
    });
  }
}
