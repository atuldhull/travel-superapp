/**
 * Transport HTTP surface.
 *
 *   POST /api/v1/transport/routes
 *     body: { origin: {lat,lng}, destination: {lat,lng}, modes?: [] }
 *     200 → { routes: RouteLeg[] }   (one cost/duration per mode)
 *     422 → INVALID_COORDINATES | SAME_ORIGIN_DESTINATION | ROUTE_TOO_LONG
 *
 *   POST /api/v1/transport/navigation
 *     body: { origin, destination, waypoints?: [] }
 *     200 → { routes: NavRoute[], recommendedRouteId, routeSource }
 *           (drawable road lines: fastest / scenic / avoid-traffic,
 *            with live(ish) traffic colouring + reroute advisories)
 *     422 → INVALID_COORDINATES | SAME_ORIGIN_DESTINATION |
 *           ROUTE_TOO_LONG | TOO_MANY_WAYPOINTS | NO_ROUTE_FOUND
 *
 * Installed by prompt [IV.18.10.1]; navigation added for the
 * live-navigation feature.
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetRoutesUseCase } from '../application/get-routes.use-case';
import { GetNavigationUseCase } from '../application/get-navigation.use-case';
import type { RouteLeg } from '../domain/route-leg.entity';
import type { NavRouteSet } from '../domain/nav-route.entity';
import { GetRoutesBodySchema, type GetRoutesBody } from './dto/transport.dto';
import { GetNavigationBodySchema, type GetNavigationBody } from './dto/navigation.dto';
import { GetRoutesRequestDto, GetRoutesResponseDto } from './dto/transport-response.dto';
import { GetNavigationRequestDto, GetNavigationResponseDto } from './dto/navigation-response.dto';

@ApiTags('transport')
@ApiBearerAuth()
@Controller('transport')
export class TransportController {
  constructor(
    private readonly getRoutes: GetRoutesUseCase,
    private readonly getNavigation: GetNavigationUseCase,
  ) {}

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

  @ApiOperation({
    summary:
      'Compute drawable road routes (fastest / scenic / avoid-traffic) with ' +
      'live(ish) traffic colouring + reroute advisories for the LiveNavMap.',
  })
  @ApiBody({ type: GetNavigationRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Route options + recommended id.',
    type: GetNavigationResponseDto,
  })
  @ApiResponse({
    status: 422,
    description:
      'INVALID_COORDINATES | SAME_ORIGIN_DESTINATION | ROUTE_TOO_LONG | ' +
      'TOO_MANY_WAYPOINTS | NO_ROUTE_FOUND.',
  })
  @Post('navigation')
  @HttpCode(HttpStatus.OK)
  async navigation(
    @Body(new ZodValidationPipe(GetNavigationBodySchema)) body: GetNavigationBody,
  ): Promise<NavRouteSet> {
    return this.getNavigation.execute({
      origin: body.origin,
      destination: body.destination,
      ...(body.waypoints && body.waypoints.length > 0 ? { waypoints: body.waypoints } : {}),
    });
  }
}
