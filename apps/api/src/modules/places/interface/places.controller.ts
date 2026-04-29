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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  DiscoverHiddenGemsUseCase,
  type HiddenGem,
} from '../application/discover-hidden-gems.use-case';
import { FederatedSearchPlacesUseCase } from '../application/federated-search-places.use-case';
import { IngestFederatedResultsUseCase } from '../application/ingest-federated-results.use-case';
import { SearchPlacesUseCase } from '../application/search-places.use-case';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import type { PlaceWithDistance } from '../domain/place.entity';
import {
  DiscoverHiddenGemsBodySchema,
  FederatedSearchPlacesBodySchema,
  SearchPlacesBodySchema,
  type DiscoverHiddenGemsBody,
  type FederatedSearchPlacesBody,
  type SearchPlacesBody,
} from './dto/places.dto';
import {
  DiscoverHiddenGemsRequestDto,
  DiscoverHiddenGemsResponseDto,
  FederatedSearchPlacesRequestDto,
  FederatedSearchPlacesResponseDto,
  SearchPlacesRequestDto,
  SearchPlacesResponseDto,
} from './dto/places-response.dto';

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

interface HiddenGemRowDto extends PlaceDto {
  readonly reviewCount: number;
  readonly reviewAverage: number;
}

function toGemDto(g: HiddenGem): HiddenGemRowDto {
  return {
    ...toDto(g),
    reviewCount: g.reviewCount,
    reviewAverage: Math.round(g.reviewAverage * 100) / 100,
  };
}

interface FederatedResultDto extends FederatedPlaceResult {
  /**
   * Canonical Place id when `ingest=true` was passed (and the row
   * was either freshly inserted or already in the catalog).
   * Omitted on a pure read.
   */
  readonly placeId?: string;
  /** True iff this call inserted the row; false if already cached
   *  in the catalog. Omitted on a pure read. */
  readonly created?: boolean;
}

@ApiTags('places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly federatedSearch: FederatedSearchPlacesUseCase,
    private readonly ingest: IngestFederatedResultsUseCase,
    private readonly discoverHiddenGems: DiscoverHiddenGemsUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Search the canonical Place catalog within a radius. Optional category filter + limit.',
  })
  @ApiBody({ type: SearchPlacesRequestDto })
  @ApiResponse({ status: 200, description: 'Matching places.', type: SearchPlacesResponseDto })
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
      requiredFeatures?: string[];
      curatedOnly?: boolean;
    } = {
      center: body.center,
      radiusKm: body.radiusKm,
    };
    if (body.category !== undefined) command.category = body.category;
    if (body.limit !== undefined) command.limit = body.limit;
    if (body.requiredFeatures !== undefined && body.requiredFeatures.length > 0) {
      command.requiredFeatures = body.requiredFeatures;
    }
    if (body.curatedOnly === true) command.curatedOnly = true;
    const places = await this.searchPlaces.execute(command);
    return { places: places.map(toDto) };
  }

  /**
   * Federated search — external providers only (Google / FSQ / OSM
   * mocks in v1). With `ingest: true`, results are also written
   * through to the canonical `Place` catalog (idempotent via
   * sha256-anchored `sourceKey` dedup), and each response item
   * carries the canonical `placeId`. Without `ingest`, the call is
   * a pure read — no DB writes, no canonical id lookup.
   */
  @ApiOperation({
    summary:
      'Federated search across external providers (Google/FSQ/OSM). Optional ingest=true write-through to the canonical catalog.',
  })
  @ApiBody({ type: FederatedSearchPlacesRequestDto })
  @ApiResponse({
    status: 200,
    description:
      'Provider results, optionally enriched with canonical placeId/created flags when ingest=true.',
    type: FederatedSearchPlacesResponseDto,
  })
  @Post('federated-search')
  @HttpCode(HttpStatus.OK)
  async federated(
    @Body(new ZodValidationPipe(FederatedSearchPlacesBodySchema))
    body: FederatedSearchPlacesBody,
  ): Promise<{ results: readonly FederatedResultDto[] }> {
    const results = await this.federatedSearch.execute({
      center: body.center,
      radiusKm: body.radiusKm,
      ...(body.category ? { category: body.category } : {}),
    });

    if (!body.ingest) {
      return { results };
    }

    const ingested = await this.ingest.execute(results);
    // `ingest.execute` preserves input order so a positional zip is
    // safe; cheaper than a Map lookup per row.
    const merged: FederatedResultDto[] = results.map((r, i) => {
      const row = ingested[i]!;
      return { ...r, placeId: row.place.id, created: row.created };
    });
    return { results: merged };
  }

  /**
   * V.UX.19 — hyper-local discovery. Returns places within a
   * day-trip radius whose review count sits in the gem zone (5..50)
   * — enough validation to trust, not so many it's a tourist trap.
   * Sorted by descending average rating (ties → higher review count).
   */
  @ApiOperation({
    summary:
      'Hidden-gem discovery within a day-trip radius. Filters to places with 5..50 reviews, sorts by average rating.',
  })
  @ApiBody({ type: DiscoverHiddenGemsRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Hidden-gem places.',
    type: DiscoverHiddenGemsResponseDto,
  })
  @Post('hidden-gems')
  @HttpCode(HttpStatus.OK)
  async hiddenGems(
    @Body(new ZodValidationPipe(DiscoverHiddenGemsBodySchema)) body: DiscoverHiddenGemsBody,
  ): Promise<{ gems: HiddenGemRowDto[] }> {
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
    const gems = await this.discoverHiddenGems.execute(command);
    return { gems: gems.map(toGemDto) };
  }
}
