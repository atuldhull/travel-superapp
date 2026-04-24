/**
 * Composite safety-score HTTP surface.
 *
 *   POST /api/v1/safety/score — crime + scam density at a coord.
 *
 * Authed-only. Separate controller from the three primitive
 * controllers (`SafetyController` / `SosController` /
 * `CrimeLayerController`) — the score is a composite read that
 * doesn't own any entity, and keeping it in its own file matches
 * the one-concern-per-controller pattern the Safety module has
 * used since [IV.18.11.1].
 *
 * Installed by prompt [IV.18.11.4].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetSafetyScoreUseCase, type SafetyScore } from '../application/get-safety-score.use-case';
import { GetSafetyScoreBodySchema, type GetSafetyScoreBody } from './dto/safety.dto';

interface SafetyScoreDto {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly score: number;
  readonly grade: string;
  readonly breakdown: {
    readonly crimes: number;
    readonly scams: number;
    readonly byCrimeSeverity: Readonly<Record<string, number>>;
    readonly byScamSeverity: Readonly<Record<string, number>>;
  };
  readonly computedAt: string;
}

function toDto(s: SafetyScore): SafetyScoreDto {
  return {
    lat: s.lat,
    lng: s.lng,
    radiusKm: s.radiusKm,
    score: s.score,
    grade: s.grade,
    breakdown: s.breakdown,
    computedAt: s.computedAt.toISOString(),
  };
}

@Controller('safety/score')
export class SafetyScoreController {
  constructor(private readonly scoreUc: GetSafetyScoreUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async score(
    @Body(new ZodValidationPipe(GetSafetyScoreBodySchema)) body: GetSafetyScoreBody,
  ): Promise<SafetyScoreDto> {
    const result = await this.scoreUc.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      ...(body.radiusKm !== undefined ? { radiusKm: body.radiusKm } : {}),
    });
    return toDto(result);
  }
}
