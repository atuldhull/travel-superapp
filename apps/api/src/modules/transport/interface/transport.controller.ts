/**
 * Transport HTTP surface. v1 is routing-only.
 *
 *   POST /api/v1/transport/routes
 *     body: { origin: {lat,lng}, destination: {lat,lng}, modes?: [] }
 *     200 → { routes: RouteLeg[] }
 *     422 → INVALID_COORDINATES | SAME_ORIGIN_DESTINATION | ROUTE_TOO_LONG
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetRoutesUseCase } from '../application/get-routes.use-case';
import type { RouteLeg } from '../domain/route-leg.entity';
import { GetRoutesBodySchema, type GetRoutesBody } from './dto/transport.dto';
import { GetRoutesRequestDto, GetRoutesResponseDto } from './dto/transport-response.dto';

@ApiTags('transport')
@ApiBearerAuth()
@Controller('transport')
export class TransportController {
  constructor(private readonly getRoutes: GetRoutesUseCase) {}

  @ApiOperation({
    summary:
      'Compute one route leg per available transport mode for the given origin → destination.',
  })
  @ApiBody({ type: GetRoutesRequestDto })
  @ApiResponse({ status: 200, description: 'One leg per mode.', type: GetRoutesResponseDto })
  @ApiResponse({
    status: 422,
    description: 'INVALID_COORDINATES | SAME_ORIGIN_DESTINATION | ROUTE_TOO_LONG.',
  })
  @Post('routes')
  @HttpCode(HttpStatus.OK)
  async routes(
    @Body(new ZodValidationPipe(GetRoutesBodySchema)) body: GetRoutesBody,
  ): Promise<{ routes: readonly RouteLeg[] }> {
    const legs = await this.getRoutes.execute({
      origin: body.origin,
      destination: body.destination,
      ...(body.modes && body.modes.length > 0 ? { modes: body.modes } : {}),
      ...(body.stepFreeOnly === true ? { stepFreeOnly: true } : {}),
    });
    return { routes: legs };
  }
}
