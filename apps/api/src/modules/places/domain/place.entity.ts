/**
 * Plain-data domain `Place`. Mirrors what Prisma exposes (PostGIS
 * `coordinates` column is `Unsupported`, so Prisma omits it from
 * reads — same pattern as the Trip module's `center`). The search
 * path returns a `PlaceWithDistance` shape so the use-case + API
 * can surface how far each result is from the query point.
 *
 * Installed by prompt [IV.18.2.9].
 */
export interface Place {
  readonly id: string;
  readonly sourceKey: string;
  readonly name: string;
  readonly category: string;
  readonly address: string | null;
  readonly countryCode: string | null;
  readonly relaxationScore: number;
  readonly metadata: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PlaceWithDistance extends Place {
  readonly distanceMeters: number;
}
