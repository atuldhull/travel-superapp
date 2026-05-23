/**
 * Admin create-place use-case. Thin wrapper around
 * `PlaceRepository.insert` for the admin HTTP surface. The Zod
 * DTO at the controller layer handles basic shape; this use-case
 * asserts the domain-level lat/lng ranges so off-HTTP callers
 * (future seed CLI) get the same guarantees.
 *
 * Admin promotion is out of scope here — the `@Roles('admin')`
 * decorator on the controller gates access.
 *
 * Installed by prompt [IV.18.3.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { Place } from '../../places/domain/place.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from '../../places';

export interface AdminCreatePlaceCommand {
  readonly sourceKey: string;
  readonly name: string;
  readonly category: string;
  readonly lat: number;
  readonly lng: number;
  readonly address?: string | null;
  readonly countryCode?: string | null;
  readonly relaxationScore?: number;
  readonly metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AdminCreatePlaceUseCase {
  constructor(@Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository) {}

  async execute(cmd: AdminCreatePlaceCommand): Promise<Place> {
    if (!Number.isFinite(cmd.lat) || cmd.lat < -90 || cmd.lat > 90) {
      throw new ValidationError(
        'Latitude out of range',
        { lat: ['must be between -90 and 90'] },
        { lat: cmd.lat },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.lng) || cmd.lng < -180 || cmd.lng > 180) {
      throw new ValidationError(
        'Longitude out of range',
        { lng: ['must be between -180 and 180'] },
        { lng: cmd.lng },
        'INVALID_COORDINATES',
      );
    }
    return this.places.insert({
      sourceKey: cmd.sourceKey,
      name: cmd.name,
      category: cmd.category,
      lat: cmd.lat,
      lng: cmd.lng,
      address: cmd.address ?? null,
      countryCode: cmd.countryCode ?? null,
      ...(cmd.relaxationScore !== undefined ? { relaxationScore: cmd.relaxationScore } : {}),
      metadata: cmd.metadata ?? null,
    });
  }
}
