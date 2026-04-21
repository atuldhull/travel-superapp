/**
 * Admin HTTP surface for Place curation. Class-level `@Roles('admin')`
 * gates every method — no `@Public()` routes here. The global
 * guard chain is rate-limit → JwtAuthGuard → RolesGuard, so a
 * non-admin bearer lands in `RolesGuard` and gets a 403
 * `ROLE_FORBIDDEN`; an unauthenticated request falls out at
 * `JwtAuthGuard` with 401 `UNAUTHENTICATED`.
 *
 * Surface (v1):
 *   - POST   /api/v1/admin/places       — curate a new Place (201).
 *   - DELETE /api/v1/admin/places/:id   — remove one (204). 404
 *     `PLACE_NOT_FOUND` if the id is unknown.
 *
 * No CLI / Makefile exists yet to promote a user to `role: 'admin'` —
 * tests flip the column directly via Prisma. That bootstrap path is
 * queued as a follow-up prompt.
 *
 * Installed by prompt [IV.18.3.1].
 */
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Roles } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { Place } from '../../places/domain/place.entity';
import { AdminCreatePlaceUseCase } from '../application/admin-create-place.use-case';
import { AdminDeletePlaceUseCase } from '../application/admin-delete-place.use-case';
import { AdminCreatePlaceBodySchema, type AdminCreatePlaceBody } from './dto/admin.dto';

interface PlaceDto {
  readonly id: string;
  readonly sourceKey: string;
  readonly name: string;
  readonly category: string;
  readonly address: string | null;
  readonly countryCode: string | null;
  readonly relaxationScore: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(p: Place): PlaceDto {
  return {
    id: p.id,
    sourceKey: p.sourceKey,
    name: p.name,
    category: p.category,
    address: p.address,
    countryCode: p.countryCode,
    relaxationScore: p.relaxationScore,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Controller('admin/places')
@Roles('admin')
export class AdminController {
  constructor(
    private readonly createPlace: AdminCreatePlaceUseCase,
    private readonly deletePlace: AdminDeletePlaceUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    // Arg-scoped pipe: @UsePipes(...) at handler level runs the body
    // schema against every arg (including @Param on other handlers if
    // we added one later). Arg-binding keeps validation where it
    // belongs, matching the [IV.18.2.5.fix] pattern across the rest
    // of the app.
    @Body(new ZodValidationPipe(AdminCreatePlaceBodySchema)) body: AdminCreatePlaceBody,
  ): Promise<PlaceDto> {
    const place = await this.createPlace.execute({
      sourceKey: body.sourceKey,
      name: body.name,
      category: body.category,
      lat: body.lat,
      lng: body.lng,
      address: body.address ?? null,
      countryCode: body.countryCode ?? null,
      ...(body.relaxationScore !== undefined ? { relaxationScore: body.relaxationScore } : {}),
      metadata: body.metadata ?? null,
    });
    return toDto(place);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deletePlace.execute(id);
  }
}
