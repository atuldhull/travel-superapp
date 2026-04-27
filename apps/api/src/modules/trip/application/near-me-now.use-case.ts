/**
 * "Near me now" — V.UX.7 spontaneous-improviser composite. One
 * request answers the three questions a phone-only tap-and-walk user
 * actually asks:
 *
 *   - "What's near me right now?" → 5 nearest places
 *   - "Is it safe? Is it raining?" → safety score + 1-day forecast
 *   - "How do I get there?" → walking leg per place
 *
 * Implementation:
 *   - SearchPlacesUseCase (radius capped at 10km — V.UX.7 walks).
 *   - GetForecastUseCase (1 day — phone screen wants a glance).
 *   - GetSafetyScoreUseCase (radius clamped at 5km).
 *   - GetRoutesUseCase per place (walking-mode preferred). Failures
 *     for a single place don't fail the whole composite — that place
 *     just gets `routes: []` (matches the per-section graceful
 *     degradation policy from `GetTripOverviewUseCase`).
 *
 * `@Public` at the controller layer — no auth needed. Same global
 * rate-limiter that protects the public sample-plan endpoint guards
 * this. No DB write side-effects.
 *
 * Installed by prompt [V.UX.7].
 */
import { Injectable } from '@nestjs/common';
import { isDomainError, ValidationError } from '@app/errors';
import type { PlaceWithDistance } from '../../places/domain/place.entity';
import { SearchPlacesUseCase } from '../../places/application/search-places.use-case';
import {
  GetSafetyScoreUseCase,
  type SafetyScore,
} from '../../safety/application/get-safety-score.use-case';
import { GetRoutesUseCase } from '../../transport/application/get-routes.use-case';
import type { RouteLeg } from '../../transport/domain/route-leg.entity';
import { GetForecastUseCase } from '../../weather/application/get-forecast.use-case';
import type { WeatherForecast } from '../../weather/domain/weather-forecast.entity';
import { GeoQueries } from '../../../common/db/geo-queries';

const NEAR_ME_RADIUS_DEFAULT_KM = 3;
const NEAR_ME_RADIUS_MAX_KM = 10;
const NEAR_ME_LIMIT = 5;
const SAFETY_RADIUS_KM = 2;

export interface NearMeNowCommand {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm?: number;
}

export interface NearMeNowPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly lat: number;
  readonly lng: number;
  readonly distanceMeters: number;
  readonly routes: readonly RouteLeg[];
}

export interface NearMeNowResult {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly places: readonly NearMeNowPlace[];
  readonly weather: WeatherForecast;
  readonly safety: SafetyScore;
  readonly fetchedAt: Date;
}

@Injectable()
export class NearMeNowUseCase {
  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly getRoutes: GetRoutesUseCase,
    private readonly getForecast: GetForecastUseCase,
    private readonly getSafetyScore: GetSafetyScoreUseCase,
    private readonly geo: GeoQueries,
  ) {}

  async execute(cmd: NearMeNowCommand): Promise<NearMeNowResult> {
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
        cmd.center,
        'INVALID_COORDINATES',
      );
    }
    const radiusKm = cmd.radiusKm
      ? Math.max(0.5, Math.min(NEAR_ME_RADIUS_MAX_KM, cmd.radiusKm))
      : NEAR_ME_RADIUS_DEFAULT_KM;

    const [places, weather, safety] = await Promise.all([
      this.searchPlaces.execute({
        center: cmd.center,
        radiusKm,
        limit: NEAR_ME_LIMIT,
      }),
      this.getForecast.execute({ lat: cmd.center.lat, lng: cmd.center.lng, days: 1 }),
      this.getSafetyScore.execute({
        lat: cmd.center.lat,
        lng: cmd.center.lng,
        radiusKm: SAFETY_RADIUS_KM,
      }),
    ]);

    // Resolve coords for every returned place via GeoQueries — the
    // SearchPlaces use-case returns `PlaceWithDistance` without
    // lat/lng (PostGIS column unsupported by Prisma, CLAUDE rule 11).
    const placeIds = places.map((p) => p.id);
    const coordsMap = await this.geo.findCoordinatesForPlaceIds(placeIds);

    const out: NearMeNowPlace[] = await Promise.all(
      places.map((p) => this.enrichPlace(p, coordsMap.get(p.id), cmd.center)),
    );

    return {
      center: cmd.center,
      radiusKm,
      places: out,
      weather,
      safety,
      fetchedAt: new Date(),
    };
  }

  /**
   * Compute the walking route from caller → place. Failures (same
   * coord, beyond cap, provider down) collapse to `routes: []` so a
   * single bad leg doesn't tank the whole composite.
   */
  private async enrichPlace(
    place: PlaceWithDistance,
    coord: { lat: number; lng: number } | undefined,
    origin: { lat: number; lng: number },
  ): Promise<NearMeNowPlace> {
    let routes: readonly RouteLeg[] = [];
    let lat = 0;
    let lng = 0;
    if (coord) {
      lat = coord.lat;
      lng = coord.lng;
      try {
        routes = await this.getRoutes.execute({
          origin,
          destination: coord,
          modes: ['walk', 'public_transit', 'taxi'],
        });
      } catch (err) {
        if (
          !isDomainError(err) ||
          !(err.code === 'SAME_ORIGIN_DESTINATION' || err.code === 'ROUTE_TOO_LONG')
        ) {
          throw err;
        }
      }
    }
    return {
      id: place.id,
      name: place.name,
      category: place.category,
      lat,
      lng,
      distanceMeters: place.distanceMeters,
      routes,
    };
  }
}
