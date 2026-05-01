/**
 * V.UX.26 — caller-owned notification preferences.
 *
 *   GET   /api/v1/notifications/preferences   — caller's row (default shape if never written)
 *   PATCH /api/v1/notifications/preferences   — partial upsert
 *
 * Lives under `/notifications/...` rather than `/account/...` so the
 * surface stays grouped with the inbox + push routes (an explicit
 * @ApiTags('notifications') groups the SDK barrel).
 *
 * Installed by prompt [V.UX.26].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetNotificationPreferencesUseCase } from '../application/get-notification-preferences.use-case';
import { UpdateNotificationPreferencesUseCase } from '../application/update-notification-preferences.use-case';
import type { NotificationPreference } from '../domain/notification-preference.entity';
import {
  NotificationPreferencesDto as NotificationPreferencesResponseDto,
  UpdateNotificationPreferencesBodySchema,
  UpdateNotificationPreferencesRequestDto,
  type UpdateNotificationPreferencesBody,
} from './dto/notification-preferences.dto';

interface NotificationPreferencesDto {
  readonly id: string;
  readonly userId: string;
  readonly push: boolean;
  readonly email: boolean;
  readonly sms: boolean;
  readonly categoriesDisabled: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(p: NotificationPreference): NotificationPreferencesDto {
  return {
    id: p.id,
    userId: p.userId,
    push: p.push,
    email: p.email,
    sms: p.sms,
    categoriesDisabled: p.categoriesDisabled,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly getUc: GetNotificationPreferencesUseCase,
    private readonly updateUc: UpdateNotificationPreferencesUseCase,
  ) {}

  @ApiOperation({
    summary:
      "Caller's notification preferences. Returns a default shape if the user has never written one.",
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences row.',
    type: NotificationPreferencesResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getMine(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferencesDto> {
    const prefs = await this.getUc.execute(user.sub);
    return toDto(prefs);
  }

  @ApiOperation({
    summary:
      'Partial upsert of the caller-owned notification prefs. Idempotent. Empty body is a no-op.',
  })
  @ApiBody({ type: UpdateNotificationPreferencesRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Updated preferences.',
    type: NotificationPreferencesResponseDto,
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED.' })
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesBodySchema))
    body: UpdateNotificationPreferencesBody,
  ): Promise<NotificationPreferencesDto> {
    const updated = await this.updateUc.execute({
      userId: user.sub,
      ...(body.push !== undefined ? { push: body.push } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.sms !== undefined ? { sms: body.sms } : {}),
      ...(body.categoriesDisabled !== undefined
        ? { categoriesDisabled: body.categoriesDisabled }
        : {}),
    });
    return toDto(updated);
  }
}
