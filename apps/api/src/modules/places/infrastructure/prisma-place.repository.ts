/**
 * Prisma + GeoQueries adapter for `PlaceRepository`. Writes + reads
 * both go through `GeoQueries` so the PostGIS `coordinates` column
 * is handled via raw SQL consistently (CLAUDE rule 11).
 *
 * Installed by prompt [IV.18.2.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Place as PrismaPlace } from '@prisma/client';
import {
  GeoQueries,
  type PlaceWithDistance as GeoQueriesDistance,
} from '../../../common/db/geo-queries';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Place, PlaceWithDistance } from '../domain/place.entity';
import type {
  FindPlacesInput,
  InsertPlaceInput,
  PlaceRepository,
} from '../application/ports/place.repository';

@Injectable()
export class PrismaPlaceRepository implements PlaceRepository {
  constructor(
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async findWithinRadius(input: FindPlacesInput): Promise<readonly PlaceWithDistance[]> {
    const rows = await this.geo.findPlacesWithinRadius({
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      ...(input.filters?.category ? { filters: { category: input.filters.category } } : {}),
    });
    return rows.map(toDomainWithDistance);
  }

  async insert(input: InsertPlaceInput): Promise<Place> {
    const row = await this.geo.insertPlace(input);
    return toDomain(row);
  }

  async findBySourceKey(sourceKey: string): Promise<Place | null> {
    // Explicit `select` skips the `Unsupported` PostGIS column —
    // Prisma's typed path tolerates that. No raw SQL needed for
    // the read.
    const row = await this.prisma.place.findUnique({
      where: { sourceKey },
      select: {
        id: true,
        sourceKey: true,
        name: true,
        category: true,
        address: true,
        countryCode: true,
        relaxationScore: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? toDomain(row as PrismaPlace) : null;
  }

  async exists(id: string): Promise<boolean> {
    // `select: { id: true }` is the lightest Prisma probe — no
    // `coordinates` column touch, no extra joins. PostGIS
    // `Unsupported` column is transparent here because we're not
    // selecting it.
    const row = await this.prisma.place.findUnique({
      where: { id },
      select: { id: true },
    });
    return row !== null;
  }

  async deleteById(id: string): Promise<boolean> {
    // `deleteMany` instead of `delete` — `delete` implicitly does
    // a `findUniqueOrThrow` first, and Prisma's generated types
    // may refuse to read the `coordinates` column (Unsupported).
    // `deleteMany` is a straight DELETE … WHERE id = $1 with no
    // up-front read, so the PostGIS column never enters the picture.
    const result = await this.prisma.place.deleteMany({ where: { id } });
    return result.count === 1;
  }
}

function toDomain(row: PrismaPlace): Place {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    name: row.name,
    category: row.category,
    address: row.address,
    countryCode: row.countryCode,
    relaxationScore: row.relaxationScore,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainWithDistance(row: GeoQueriesDistance): PlaceWithDistance {
  return {
    ...toDomain(row),
    distanceMeters: row.distanceMeters,
  };
}
