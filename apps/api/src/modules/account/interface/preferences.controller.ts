/**
 * V.UX.14 — preferences HTTP surface.
 *
 *   GET   /api/v1/account/preferences   — caller's row (or default)
 *   PATCH /api/v1/account/preferences   — partial upsert
 *
 * Lives under `/account` like the rest of the caller-self surface
 * (export / delete / trusted-contacts). Two routes, both
 * authenticated; no admin variant.
 *
 * Installed by prompt [V.UX.14].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetPreferencesUseCase } from '../application/get-preferences.use-case';
import { UpdatePreferencesUseCase } from '../application/update-preferences.use-case';
import type { Preferences } from '../domain/preferences.entity';
import {
  PreferencesDto as PreferencesResponseDto,
  UpdatePreferencesBodySchema,
  UpdatePreferencesRequestDto,
  type UpdatePreferencesBody,
} from './dto/preferences.dto';

interface PreferencesDto {
  readonly id: string;
  readonly userId: string;
  readonly diet: readonly string[];
  readonly accessibility: readonly string[];
  readonly travelType: readonly string[];
  readonly budgetTier: number;
  readonly familyMode: boolean;
  readonly kidAges: readonly number[];
  readonly comfortMode: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(p: Preferences): PreferencesDto {
  return {
    id: p.id,
    userId: p.userId,
    diet: p.diet,
    accessibility: p.accessibility,
    travelType: p.travelType,
    budgetTier: p.budgetTier,
    familyMode: p.familyMode,
    kidAges: p.kidAges,
    comfortMode: p.comfortMode,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@ApiTags('account')
@ApiBearerAuth()
@Controller('account/preferences')
export class PreferencesController {
  constructor(
    private readonly getUc: GetPreferencesUseCase,
    private readonly updateUc: UpdatePreferencesUseCase,
  ) {}

  @ApiOperation({
    summary:
      "Caller's preferences. Returns a synthetic default shape if the user has never written any.",
  })
  @ApiResponse({ status: 200, description: 'Preferences row.', type: PreferencesResponseDto })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getMine(@CurrentUser() user: AuthenticatedUser): Promise<PreferencesDto> {
    const prefs = await this.getUc.execute(user.sub);
    return toDto(prefs);
  }

  @ApiOperation({
    summary:
      'Partial update of the caller-owned preferences. Idempotent upsert; empty body is a no-op.',
  })
  @ApiBody({ type: UpdatePreferencesRequestDto })
  @ApiResponse({ status: 200, description: 'Updated preferences.', type: PreferencesResponseDto })
  @ApiResponse({
    status: 422,
    description: 'INVALID_BUDGET_TIER, INVALID_KID_AGE, or TOO_MANY_KIDS.',
  })
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdatePreferencesBodySchema)) body: UpdatePreferencesBody,
  ): Promise<PreferencesDto> {
    const updated = await this.updateUc.execute({
      userId: user.sub,
      ...(body.diet !== undefined ? { diet: body.diet } : {}),
      ...(body.accessibility !== undefined ? { accessibility: body.accessibility } : {}),
      ...(body.travelType !== undefined ? { travelType: body.travelType } : {}),
      ...(body.budgetTier !== undefined ? { budgetTier: body.budgetTier } : {}),
      ...(body.familyMode !== undefined ? { familyMode: body.familyMode } : {}),
      ...(body.kidAges !== undefined ? { kidAges: body.kidAges } : {}),
      ...(body.comfortMode !== undefined ? { comfortMode: body.comfortMode } : {}),
    });
    return toDto(updated);
  }
}
