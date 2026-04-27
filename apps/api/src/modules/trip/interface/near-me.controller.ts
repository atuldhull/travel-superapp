/**
 * V.UX.7 spontaneous-improviser composite. `POST /api/v1/near-me`.
 *
 * Public, no auth, no DB writes. The phone-only single-tap flow
 * doesn't need the user signed in to look up "what's around me".
 * The global rate-limiter + the validation pipe keep the surface
 * safe.
 *
 * Returns:
 *   - up to 5 nearest places (with walking-mode preferred routes)
 *   - 1-day weather forecast for the caller's coords
 *   - safety score (0–100 + grade) for a 2km radius
 *
 * Installed by prompt [V.UX.7].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { NearMeNowUseCase } from '../application/near-me-now.use-case';
import { NearMeNowBodySchema, type NearMeNowBody } from './dto/trip.dto';
import { NearMeNowRequestDto, NearMeNowResponseDto } from './dto/trip-response.dto';

interface NearMeRouteLeg {
  readonly mode: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly estimatedCostUsd: number | null;
  readonly confidence: string;
}

interface NearMeNowResponseShape {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly places: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly lat: number;
    readonly lng: number;
    readonly distanceMeters: number;
    readonly routes: readonly NearMeRouteLeg[];
  }>;
  readonly weather: {
    readonly lat: number;
    readonly lng: number;
    readonly timezone: string;
    readonly days: ReadonlyArray<{
      readonly date: string;
      readonly maxTempC: number;
      readonly minTempC: number;
      readonly weatherCode: number;
      readonly precipitationProbabilityPercent: number | null;
    }>;
  };
  readonly safety: {
    readonly score: number;
    readonly grade: string;
    readonly breakdown: { readonly crimes: number; readonly scams: number };
    readonly radiusKm: number;
  };
  readonly fetchedAt: string;
}

@ApiTags('near-me')
@Controller('near-me')
export class NearMeController {
  constructor(private readonly nearMeNow: NearMeNowUseCase) {}

  @ApiOperation({
    summary:
      'Spontaneous-improviser composite — 5 nearest places + walking routes + 1-day weather + safety score. Public, no auth.',
  })
  @ApiBody({ type: NearMeNowRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Composite response with places + weather + safety.',
    type: NearMeNowResponseDto,
  })
  @ApiResponse({ status: 422, description: 'INVALID_COORDINATES.' })
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async nearMe(
    @Body(new ZodValidationPipe(NearMeNowBodySchema)) body: NearMeNowBody,
  ): Promise<NearMeNowResponseShape> {
    const result = await this.nearMeNow.execute({
      center: body.center,
      ...(body.radiusKm !== undefined ? { radiusKm: body.radiusKm } : {}),
    });
    return {
      center: result.center,
      radiusKm: result.radiusKm,
      places: result.places.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        distanceMeters: p.distanceMeters,
        routes: p.routes.map((r) => ({
          mode: r.mode,
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSeconds,
          estimatedCostUsd: r.estimatedCostUsd,
          confidence: r.confidence,
        })),
      })),
      weather: {
        lat: result.weather.lat,
        lng: result.weather.lng,
        timezone: result.weather.timezone,
        days: result.weather.days.map((d) => ({
          date: d.date,
          maxTempC: d.maxTempC,
          minTempC: d.minTempC,
          weatherCode: d.weatherCode,
          precipitationProbabilityPercent: d.precipitationProbabilityPercent,
        })),
      },
      safety: {
        score: result.safety.score,
        grade: result.safety.grade,
        breakdown: {
          crimes: result.safety.breakdown.crimes,
          scams: result.safety.breakdown.scams,
        },
        radiusKm: result.safety.radiusKm,
      },
      fetchedAt: result.fetchedAt.toISOString(),
    };
  }
}
