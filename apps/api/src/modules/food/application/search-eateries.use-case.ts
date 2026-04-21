/**
 * Search eateries within a radius of a coordinate, optionally
 * filtered by cuisine + price tier. Business logic is input
 * validation + clamping; caching lives in the decorator
 * (`CachedEateryProvider`) so this use-case stays stateless +
 * provider-agnostic.
 *
 * Installed by prompt [IV.18.7.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { EateryListing } from '../domain/eatery-listing.entity';
import { EATERY_PROVIDER, type EateryProvider } from './ports/eatery-provider';

const MAX_RADIUS_KM = 25;
const MIN_PRICE_TIER = 1;
const MAX_PRICE_TIER = 5;

export interface SearchEateriesCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly cuisineTag?: string;
  readonly maxPriceTier?: number;
}

@Injectable()
export class SearchEateriesUseCase {
  constructor(@Inject(EATERY_PROVIDER) private readonly provider: EateryProvider) {}

  async execute(cmd: SearchEateriesCommand): Promise<readonly EateryListing[]> {
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
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be positive',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_RADIUS_KM) {
      throw new ValidationError(
        `Radius too large (max ${MAX_RADIUS_KM}km)`,
        { radiusKm: [`must be ≤ ${MAX_RADIUS_KM}`] },
        { radiusKm: cmd.radiusKm, max: MAX_RADIUS_KM },
        'INVALID_RADIUS',
      );
    }

    if (cmd.maxPriceTier !== undefined) {
      if (
        !Number.isFinite(cmd.maxPriceTier) ||
        cmd.maxPriceTier < MIN_PRICE_TIER ||
        cmd.maxPriceTier > MAX_PRICE_TIER
      ) {
        throw new ValidationError(
          `Price tier out of range (${MIN_PRICE_TIER}..${MAX_PRICE_TIER})`,
          {
            maxPriceTier: [`must be between ${MIN_PRICE_TIER} and ${MAX_PRICE_TIER}`],
          },
          { maxPriceTier: cmd.maxPriceTier },
          'INVALID_PRICE_TIER',
        );
      }
    }

    return this.provider.searchNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.cuisineTag ? { cuisineTag: cmd.cuisineTag } : {}),
      ...(cmd.maxPriceTier !== undefined ? { maxPriceTier: cmd.maxPriceTier } : {}),
    });
  }
}
