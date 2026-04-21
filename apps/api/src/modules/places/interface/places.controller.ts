/**
 * Places HTTP surface. Every route is protected by the global
 * JwtAuthGuard — search is gated on authentication so the rate
 * limiter can key on user id + lets us attribute usage.
 *
 * Surface (v1):
 *   - POST /api/v1/places/search — within-radius query with
 *     optional category filter + limit.
 *
 * Insert / seed is admin-only and lives off-HTTP for now; a
 * later `[IV.18.2.9.1]` prompt adds `POST /admin/places` once
 * the RolesGuard has an 'admin' seeding flow.
 *
 * Installed by prompt [IV.18.2.9].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SearchPlacesUseCase } from '../application/search-places.use-case';
import type { PlaceWithDistance } from '../domain/place.entity';
import { SearchPlacesBodySchema, type SearchPlacesBody } from './dto/places.dto';

interface PlaceDto {
  readonly id: string;
  readonly sourceKey: string;
  readonly name: string;
  readonly category: string;
  readonly address: string | null;
  readonly countryCode: string | null;
  readonly relaxationScore: number;
  readonly distanceMeters: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(p: PlaceWithDistance): PlaceDto {
  return {
    id: p.id,
    sourceKey: p.sourceKey,
    name: p.name,
    category: p.category,
    address: p.address,
    countryCode: p.countryCode,
    relaxationScore: p.relaxationScore,
    distanceMeters: p.distanceMeters,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Controller('places')
export class PlacesController {
  constructor(private readonly searchPlaces: SearchPlacesUseCase) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    // Arg-scoped pipe — same fix as the PATCH /trips/:id regression
    // in [IV.18.2.5.fix]. `@UsePipes` at handler level runs the
    // body schema against `@Query` + `@Param` args too, which would
    // fail on anything that isn't the expected object.
    @Body(new ZodValidationPipe(SearchPlacesBodySchema)) body: SearchPlacesBody,
  ): Promise<{ places: PlaceDto[] }> {
    const command: {
      center: { lat: number; lng: number };
      radiusKm: number;
      category?: string;
      limit?: number;
    } = {
      center: body.center,
      radiusKm: body.radiusKm,
    };
    if (body.category !== undefined) command.category = body.category;
    if (body.limit !== undefined) command.limit = body.limit;
    const places = await this.searchPlaces.execute(command);
    return { places: places.map(toDto) };
  }
}
