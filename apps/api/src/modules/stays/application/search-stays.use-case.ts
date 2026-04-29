/**
 * Search for stays near a coordinate, within a radius, for a given
 * date range + party size. Thin shell over the `STAY_PROVIDER` port
 * — the business logic is range validation + clamps. Caching lives
 * in the decorator (`CachedStayProvider`) so the use-case is
 * stateless + provider-agnostic.
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { StayListing } from '../domain/stay-listing.entity';
import { STAY_PROVIDER, type StayProvider } from './ports/stay-provider';

const MAX_RADIUS_KM = 50;
const MAX_GUESTS = 20;
// V.UX.23 — bumped from 30 to 90 nights so the digital-nomad
// persona's 4-week / 8-week long-stay searches are valid. Old
// short-trip callers are unaffected — the cap was always upper-bound.
const MAX_TRIP_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SearchStaysCommand {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guests?: number;
  /**
   * V.UX.14 — when set, a listing must include every amenity in
   * the array (case-insensitive substring/equality match against
   * its `amenities` field). Empty / missing = no filter. Family-
   * mode UI passes `['crib', 'high_chair', 'stroller_accessible']`
   * by default; users can prune the chips before searching.
   */
  readonly requiredAmenities?: readonly string[];
  /**
   * V.UX.16 — case-insensitive exact match against `StayListing.stayType`.
   * Budget-backpacker UI passes `'hostel'`; family persona could
   * prefer `'apartment'`. Empty / missing = no filter.
   */
  readonly stayType?: string;
  /**
   * V.UX.16 — when set, listings whose `priceUsdPerNight` exceeds
   * the cap are dropped. Listings with `null` price are kept
   * (provider didn't quote — the user decides on click-through).
   */
  readonly maxPriceUsdPerNight?: number;
  /**
   * V.UX.23 — digital-nomad wifi-speed floor (Mbps). Listings whose
   * `wifiSpeedMbps` falls below this number are dropped. Listings
   * with `null` wifiSpeedMbps are also dropped when the filter is
   * set — better to omit a "we don't know" listing than to suggest
   * it might be fast enough.
   */
  readonly minWifiSpeedMbps?: number;
}

@Injectable()
export class SearchStaysUseCase {
  constructor(@Inject(STAY_PROVIDER) private readonly provider: StayProvider) {}

  async execute(cmd: SearchStaysCommand): Promise<readonly StayListing[]> {
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

    if (!ISO_DATE.test(cmd.checkIn) || !ISO_DATE.test(cmd.checkOut)) {
      throw new ValidationError(
        'checkIn/checkOut must be YYYY-MM-DD',
        { checkIn: ['YYYY-MM-DD'], checkOut: ['YYYY-MM-DD'] },
        { checkIn: cmd.checkIn, checkOut: cmd.checkOut },
        'INVALID_DATE_RANGE',
      );
    }
    const checkInMs = Date.parse(cmd.checkIn);
    const checkOutMs = Date.parse(cmd.checkOut);
    if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs)) {
      throw new ValidationError(
        'checkIn/checkOut unparseable',
        { checkIn: ['invalid date'], checkOut: ['invalid date'] },
        { checkIn: cmd.checkIn, checkOut: cmd.checkOut },
        'INVALID_DATE_RANGE',
      );
    }
    if (checkOutMs <= checkInMs) {
      throw new ValidationError(
        'checkOut must be after checkIn',
        { checkOut: ['must be after checkIn'] },
        { checkIn: cmd.checkIn, checkOut: cmd.checkOut },
        'INVALID_DATE_RANGE',
      );
    }
    const dayCount = Math.round((checkOutMs - checkInMs) / 86_400_000);
    if (dayCount > MAX_TRIP_DAYS) {
      throw new ValidationError(
        `Date range too long (max ${MAX_TRIP_DAYS} nights)`,
        { checkOut: [`must be within ${MAX_TRIP_DAYS} days of checkIn`] },
        { dayCount, max: MAX_TRIP_DAYS },
        'INVALID_DATE_RANGE',
      );
    }

    const guests =
      cmd.guests === undefined ? 1 : Math.max(1, Math.min(MAX_GUESTS, Math.floor(cmd.guests)));

    const listings = await this.provider.searchNearby({
      lat: cmd.lat,
      lng: cmd.lng,
      radiusKm: cmd.radiusKm,
      checkIn: cmd.checkIn,
      checkOut: cmd.checkOut,
      guests,
    });

    const required = (cmd.requiredAmenities ?? [])
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.length > 0);
    const stayType = cmd.stayType?.trim().toLowerCase();
    const maxPrice =
      typeof cmd.maxPriceUsdPerNight === 'number' && cmd.maxPriceUsdPerNight > 0
        ? cmd.maxPriceUsdPerNight
        : null;
    const minWifi =
      typeof cmd.minWifiSpeedMbps === 'number' && cmd.minWifiSpeedMbps > 0
        ? cmd.minWifiSpeedMbps
        : null;

    if (required.length === 0 && !stayType && maxPrice === null && minWifi === null) {
      return listings;
    }

    return listings.filter((l) => {
      // V.UX.14 — required amenities (substring match).
      if (required.length > 0) {
        const lower = l.amenities.map((a) => a.toLowerCase());
        if (!required.every((r) => lower.some((a) => a.includes(r)))) return false;
      }
      // V.UX.16 — exact stayType match (case-insensitive).
      if (stayType && l.stayType.toLowerCase() !== stayType) return false;
      // V.UX.16 — price cap; listings with null price (no live quote)
      // pass through so the user can click for a quote.
      if (maxPrice !== null && l.priceUsdPerNight !== null && l.priceUsdPerNight > maxPrice) {
        return false;
      }
      // V.UX.23 — wifi-speed floor; null-wifi listings are dropped
      // when the filter is set (vs the price-cap behaviour, since
      // "wifi speed is unknown" is a stronger negative signal for
      // the nomad persona than "price not quoted").
      if (minWifi !== null && (l.wifiSpeedMbps === null || l.wifiSpeedMbps < minWifi)) {
        return false;
      }
      return true;
    });
  }
}
