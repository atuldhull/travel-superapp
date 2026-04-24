/**
 * Safety crime-layer HTTP surface.
 *
 *   POST /api/v1/safety/crimes/search — within-radius query with
 *         optional category / minSeverity / sinceDays filters.
 *
 * Authenticated-only. No POST (user report) endpoint exists —
 * CrimeIncident rows come from external upstream data (government
 * feeds, Numbeo, aggregated user reports); the write path is a
 * seed script + future ingest worker, not an HTTP route.
 *
 * Kept in its own controller alongside `SafetyController` (scam
 * reports) + `SosController` — same rationale each time: one
 * controller per safety primitive so the DI graph + tests read
 * cleanly.
 *
 * Installed by prompt [IV.18.11.3].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { FindNearbyCrimesUseCase } from '../application/find-nearby-crimes.use-case';
import type { CrimeIncidentWithDistance } from '../domain/crime-incident.entity';
import { FindNearbyCrimesBodySchema, type FindNearbyCrimesBody } from './dto/safety.dto';

interface CrimeIncidentDto {
  readonly id: string;
  readonly source: string;
  readonly category: string;
  readonly severity: string;
  readonly reportedAt: string;
  readonly distanceMeters: number;
}

function toDto(c: CrimeIncidentWithDistance): CrimeIncidentDto {
  return {
    id: c.id,
    source: c.source,
    category: c.category,
    severity: c.severity,
    reportedAt: c.reportedAt.toISOString(),
    distanceMeters: c.distanceMeters,
  };
}

@Controller('safety/crimes')
export class CrimeLayerController {
  constructor(private readonly findUc: FindNearbyCrimesUseCase) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body(new ZodValidationPipe(FindNearbyCrimesBodySchema)) body: FindNearbyCrimesBody,
  ): Promise<{ incidents: CrimeIncidentDto[] }> {
    const rows = await this.findUc.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      radiusKm: body.radiusKm,
      ...(body.category ? { category: body.category } : {}),
      ...(body.minSeverity ? { minSeverity: body.minSeverity } : {}),
      ...(body.sinceDays !== undefined ? { sinceDays: body.sinceDays } : {}),
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
    });
    return { incidents: rows.map(toDto) };
  }
}
