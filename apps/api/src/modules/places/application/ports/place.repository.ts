/**
 * Port for Place persistence + geospatial search. Adapter delegates
 * to the existing `GeoQueries` raw-SQL layer (CLAUDE rule 11 — the
 * PostGIS `coordinates` column never goes through Prisma's
 * generated types).
 *
 * `insert` is on the port so an admin-side seed script (or a future
 * `POST /admin/places` endpoint) has a type-checked seam. No
 * user-facing route exercises it today.
 *
 * Installed by prompt [IV.18.2.9].
 */
import type { Place, PlaceWithDistance } from '../../domain/place.entity';

export interface FindPlacesInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly filters?: {
    readonly category?: string;
  };
}

export interface InsertPlaceInput {
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

export interface PlaceRepository {
  /**
   * Return every Place within `radiusKm` of the query point,
   * ordered ascending by distance. Optional category filter.
   * The result is bounded by the use-case layer, not the repo —
   * caller should slice the returned array.
   */
  findWithinRadius(input: FindPlacesInput): Promise<readonly PlaceWithDistance[]>;

  /** Admin / seed-only. `sourceKey` must be unique; callers are
   *  expected to provide a stable id (`osm:way/12345`, `google:<id>`). */
  insert(input: InsertPlaceInput): Promise<Place>;

  /**
   * Existence probe — returns `true` iff a Place with this id
   * exists. Used by Trip's `UpdateDayItemsUseCase` to validate
   * every incoming `placeId` without loading the full row or
   * running a radius query. Deliberately narrow surface — if
   * callers need the row, they query the appropriate search
   * method instead.
   */
  exists(id: string): Promise<boolean>;

  /**
   * Delete a Place by id. Returns `true` iff a row was actually
   * removed (i.e., the id existed). Admin-only — the HTTP surface
   * is `DELETE /admin/places/:id`. Callers should translate a
   * `false` return into a 404 `PLACE_NOT_FOUND`.
   */
  deleteById(id: string): Promise<boolean>;
}

export const PLACE_REPOSITORY = Symbol('PlaceRepository');
