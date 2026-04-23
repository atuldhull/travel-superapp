import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Place, Prisma, ScamReport, ScamSeverity, Trip } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * PostGIS-aware DB access for rows whose `geography(Point, 4326)`
 * columns Prisma cannot type.
 *
 * Every method goes through `$queryRaw` / `$executeRaw` with
 * `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` so SRID 4326
 * (WGS-84) is used consistently across the app.
 *
 * CLAUDE rule 11 — domain code MUST NOT call `prisma.place.create`
 * directly; those paths would silently skip the coordinates column
 * (Prisma types it as `Unsupported`). Go through `GeoQueries`.
 *
 * Installed by prompt [III.12.2].
 */
@Injectable()
export class GeoQueries {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Insert a Place row with typed fields + PostGIS Point coordinate.
   * Returns the freshly-inserted row (Prisma-generated `Place` type).
   */
  async insertPlace(input: InsertPlaceInput): Promise<Place> {
    // Ids on raw-SQL-inserted rows are UUIDv4 rather than Prisma's cuid.
    // The `id` column is typed `String` with a client-default of `cuid()`
    // — the DB itself accepts any varchar. Mixed formats are tolerable;
    // re-evaluate if id-format observability becomes important.
    const id = randomUUID();
    const now = new Date();
    const metadata = (input.metadata ?? null) as Prisma.InputJsonValue | null;
    const rows = await this.prisma.$queryRaw<Place[]>`
      INSERT INTO "Place" (
        id, "sourceKey", name, category, coordinates, address,
        "countryCode", "relaxationScore", metadata, "createdAt", "updatedAt"
      )
      VALUES (
        ${id},
        ${input.sourceKey},
        ${input.name},
        ${input.category},
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.address ?? null},
        ${input.countryCode ?? null},
        ${input.relaxationScore ?? 0},
        ${metadata}::jsonb,
        ${now},
        ${now}
      )
      RETURNING
        id, "sourceKey", name, category, address, "countryCode",
        "relaxationScore", metadata, "createdAt", "updatedAt"
    `;
    const row = rows[0];
    if (!row) {
      throw new Error('insertPlace: no row returned');
    }
    return row;
  }

  /**
   * Find every Place within `radiusKm` of (`lat`, `lng`), optionally
   * filtered by category. Orders by ascending distance.
   */
  async findPlacesWithinRadius(input: FindPlacesInput): Promise<PlaceWithDistance[]> {
    const categoryFilter = input.filters?.category ?? null;
    const radiusMeters = input.radiusKm * 1000;

    return this.prisma.$queryRaw<PlaceWithDistance[]>`
      SELECT
        id, "sourceKey", name, category, address, "countryCode",
        "relaxationScore", metadata, "createdAt", "updatedAt",
        ST_Distance(
          coordinates,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        )::double precision AS "distanceMeters"
      FROM "Place"
      WHERE
        ST_DWithin(
          coordinates,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${radiusMeters}
        )
        AND (${categoryFilter}::text IS NULL OR category = ${categoryFilter}::text)
      ORDER BY "distanceMeters" ASC
    `;
  }

  /**
   * Insert a Trip row with typed fields + a PostGIS `center` point.
   * Goes via raw SQL because `Trip.center` is `Unsupported` to Prisma
   * (see CLAUDE rule 11).
   *
   * Returns every field Prisma knows about — `center` itself isn't
   * echoed back (clients don't need to read their own input).
   */
  async insertTrip(input: InsertTripInput): Promise<Trip> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.prisma.$queryRaw<Trip[]>`
      INSERT INTO "Trip" (
        id, "userId", title, status, center, "radiusKm", "startsOn",
        "endsOn", version, "createdAt", "updatedAt"
      )
      VALUES (
        ${id},
        ${input.userId},
        ${input.title},
        ${input.status ?? 'draft'}::"TripStatus",
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.radiusKm},
        ${input.startsOn ?? null},
        ${input.endsOn ?? null},
        1,
        ${now},
        ${now}
      )
      RETURNING
        id, "userId", title, status, "radiusKm", "startsOn",
        "endsOn", version, "createdAt", "updatedAt"
    `;
    const row = rows[0];
    if (!row) {
      throw new Error('insertTrip: no row returned');
    }
    return row;
  }

  /**
   * Pluck the `center` lat/lng for a Trip row. Returns `null` when
   * no trip matches. Goes via raw SQL because `Trip.center` is
   * `Unsupported` to Prisma (see CLAUDE rule 11). Used by the
   * itinerary generator to scope the places search to the trip's
   * radius without requiring the full PostGIS shape on the Trip
   * domain type.
   */
  async findTripCenter(tripId: string): Promise<{ lat: number; lng: number } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng
      FROM "Trip"
      WHERE id = ${tripId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  /**
   * Move an existing Place to a new lat/lng. Returns the row count
   * actually updated (0 if no Place with that id exists).
   */
  async updatePlaceCoordinates(id: string, lat: number, lng: number): Promise<number> {
    const now = new Date();
    return this.prisma.$executeRaw`
      UPDATE "Place"
      SET
        coordinates = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        "updatedAt" = ${now}
      WHERE id = ${id}
    `;
  }

  /**
   * Insert a ScamReport row. `coordinates` goes via PostGIS raw SQL
   * (same Unsupported-column pattern as Place / Trip). `evidenceUrls`
   * is a Postgres `text[]` — empty-array default keeps the NOT NULL
   * column honest.
   *
   * Installed for prompt [IV.18.11.1].
   */
  async insertScamReport(input: InsertScamReportInput): Promise<ScamReport> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.prisma.$queryRaw<ScamReport[]>`
      INSERT INTO "ScamReport" (
        id, "reporterId", category, severity, coordinates, description,
        "evidenceUrls", verified, "createdAt", "updatedAt"
      )
      VALUES (
        ${id},
        ${input.reporterId},
        ${input.category},
        ${input.severity}::"ScamSeverity",
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${input.description},
        ${input.evidenceUrls ?? []}::text[],
        ${input.verified ?? false},
        ${now},
        ${now}
      )
      RETURNING
        id, "reporterId", category, severity, description, "evidenceUrls",
        verified, "createdAt", "updatedAt"
    `;
    const row = rows[0];
    if (!row) {
      throw new Error('insertScamReport: no row returned');
    }
    return row;
  }

  /**
   * Find every ScamReport within `radiusKm` of (`lat`, `lng`),
   * ordered ascending by distance. Optional category / min-severity
   * filters. `minSeverity` is threshold-style: `medium` matches
   * medium/high/critical.
   *
   * Installed for prompt [IV.18.11.1].
   */
  async findScamReportsWithinRadius(
    input: FindScamReportsInput,
  ): Promise<ScamReportWithDistance[]> {
    const categoryFilter = input.filters?.category ?? null;
    const minSeverityRank =
      input.filters?.minSeverity === undefined ? null : severityRank(input.filters.minSeverity);
    const radiusMeters = input.radiusKm * 1000;

    return this.prisma.$queryRaw<ScamReportWithDistance[]>`
      SELECT
        id, "reporterId", category, severity, description, "evidenceUrls",
        verified, "createdAt", "updatedAt",
        ST_Distance(
          coordinates,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        )::double precision AS "distanceMeters"
      FROM "ScamReport"
      WHERE
        ST_DWithin(
          coordinates,
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${radiusMeters}
        )
        AND (${categoryFilter}::text IS NULL OR category = ${categoryFilter}::text)
        AND (
          ${minSeverityRank}::int IS NULL
          OR (CASE severity
                WHEN 'low'      THEN 1
                WHEN 'medium'   THEN 2
                WHEN 'high'     THEN 3
                WHEN 'critical' THEN 4
              END) >= ${minSeverityRank}::int
        )
      ORDER BY "distanceMeters" ASC
    `;
  }
}

function severityRank(severity: ScamSeverity): number {
  switch (severity) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
  }
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

export interface FindPlacesInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly filters?: {
    readonly category?: string;
  };
}

/** Prisma-generated Place row + the computed geodesic distance in metres. */
export type PlaceWithDistance = Place & { readonly distanceMeters: number };

export interface InsertTripInput {
  readonly userId: string;
  readonly title: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly status?: 'draft' | 'published' | 'archived';
  readonly startsOn?: Date | null;
  readonly endsOn?: Date | null;
}

export interface InsertScamReportInput {
  readonly reporterId: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly lat: number;
  readonly lng: number;
  readonly description: string;
  readonly evidenceUrls?: readonly string[];
  readonly verified?: boolean;
}

export interface FindScamReportsInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly filters?: {
    readonly category?: string;
    readonly minSeverity?: ScamSeverity;
  };
}

export type ScamReportWithDistance = ScamReport & { readonly distanceMeters: number };
