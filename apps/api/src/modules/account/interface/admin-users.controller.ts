/**
 * Admin user-management HTTP surface.
 *
 *   GET  /api/v1/admin/users?role=&deleted=&q=&limit=&offset=
 *   POST /api/v1/admin/users/:id/ban
 *   POST /api/v1/admin/users/:id/unban
 *
 * Class-level `@Roles('admin')` gates every method. The global
 * guard chain (rate-limit → JwtAuth → Roles) handles 401/403.
 *
 * Lives in the Account module (NOT AdminModule) — same pattern
 * as admin scam moderation in Safety (`[IV.18.11.5]`) and
 * admin places curation in Places (`[IV.18.3.x]`). Account
 * already owns `User.deletedAt`; the admin ban endpoint is just
 * a different auth posture on the same lifecycle.
 *
 * Installed by prompt [IV.18.18.1].
 */
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AdminBanUserUseCase } from '../application/admin-ban-user.use-case';
import {
  AdminListBanAppealsUseCase,
  type AdminListedBanAppeal,
  type BanAppealStatus,
} from '../application/admin-list-ban-appeals.use-case';
import { AdminListUsersUseCase } from '../application/admin-list-users.use-case';
import { AdminUnbanUserUseCase } from '../application/admin-unban-user.use-case';
import type { AdminUserRow } from '../application/ports/admin-user-query';
import { AdminListUsersResponseDto } from '../../admin/interface/dto/admin-response.dto';

class AdminBanRequestDto {
  @ApiProperty({
    description: 'V.UX.34 — user-readable reason. Shown verbatim on the banned-login page.',
    minLength: 1,
    maxLength: 280,
  })
  declare reason: string;
}

const AdminBanBodySchema = z.object({
  reason: z.string().trim().min(1).max(280),
});
type AdminBanBody = z.infer<typeof AdminBanBodySchema>;

class AdminBanAppealDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare emailHash: string;

  @ApiProperty()
  declare body: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  declare status: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

class AdminListBanAppealsResponseDto {
  @ApiProperty({ type: [AdminBanAppealDto] })
  declare appeals: AdminBanAppealDto[];

  @ApiProperty()
  declare total: number;
}

const VALID_APPEAL_STATUSES: readonly BanAppealStatus[] = ['pending', 'approved', 'rejected'];

function appealToDto(a: AdminListedBanAppeal): {
  id: string;
  userId: string;
  emailHash: string;
  body: string;
  status: string;
  createdAt: string;
} {
  return {
    id: a.id,
    userId: a.userId,
    emailHash: a.emailHash,
    body: a.body,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

const VALID_ROLES: readonly UserRole[] = ['user', 'premium', 'agent', 'admin'];

interface AdminUserDto {
  readonly id: string;
  readonly emailHash: string;
  readonly displayName: string;
  readonly role: string;
  readonly mfaEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

function toDto(u: AdminUserRow): AdminUserDto {
  return {
    id: u.id,
    emailHash: u.emailHash,
    displayName: u.displayName,
    role: u.role,
    mfaEnabled: u.mfaEnabled,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(
    private readonly listUc: AdminListUsersUseCase,
    private readonly banUc: AdminBanUserUseCase,
    private readonly unbanUc: AdminUnbanUserUseCase,
    private readonly listAppealsUc: AdminListBanAppealsUseCase,
  ) {}

  @ApiOperation({
    summary:
      'List users with optional ?role / ?deleted / ?q filters. Offset pagination via ?limit + ?offset. Admin-only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching users + total.',
    type: AdminListUsersResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED — role not in user|premium|agent|admin.',
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('role') role?: string,
    @Query('deleted') deleted?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ users: AdminUserDto[]; total: number }> {
    let parsedRole: UserRole | undefined;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as UserRole)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `role must be one of: ${VALID_ROLES.join(' | ')}`,
        });
      }
      parsedRole = role as UserRole;
    }
    const parsedDeleted = deleted === 'true' ? true : deleted === 'false' ? false : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const trimmedQ = q?.trim();

    const result = await this.listUc.execute({
      ...(parsedRole !== undefined ? { role: parsedRole } : {}),
      ...(parsedDeleted !== undefined ? { deleted: parsedDeleted } : {}),
      ...(trimmedQ !== undefined && trimmedQ.length > 0 ? { q: trimmedQ } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { users: result.rows.map(toDto), total: result.total };
  }

  @ApiOperation({
    summary:
      'V.UX.34 — ban a user with a user-readable reason. Sets bannedAt + banReason + revokes sessions.',
  })
  @ApiBody({ type: AdminBanRequestDto })
  @ApiResponse({ status: 204, description: 'Banned.' })
  @ApiResponse({ status: 422, description: 'INVALID_BAN_REASON.' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND.' })
  @Post(':id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ban(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminBanBodySchema)) body: AdminBanBody,
  ): Promise<void> {
    await this.banUc.execute({ actorId: admin.sub, targetUserId: id, reason: body.reason });
  }

  @ApiOperation({
    summary: 'V.UX.34 — unban a user (clears bannedAt + banReason). Admin-only.',
  })
  @ApiResponse({ status: 204, description: 'Unbanned.' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND.' })
  @Post(':id/unban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unban(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.unbanUc.execute({ actorId: admin.sub, targetUserId: id });
  }

  @ApiOperation({
    summary: 'V.UX.34 — list ban appeals. Defaults to status=pending. Admin moderation queue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appeals + total count.',
    type: AdminListBanAppealsResponseDto,
  })
  @Get('appeals')
  @HttpCode(HttpStatus.OK)
  async listAppeals(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ appeals: ReturnType<typeof appealToDto>[]; total: number }> {
    let parsedStatus: BanAppealStatus | undefined;
    if (status !== undefined) {
      if (!VALID_APPEAL_STATUSES.includes(status as BanAppealStatus)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `status must be one of: ${VALID_APPEAL_STATUSES.join(' | ')}`,
        });
      }
      parsedStatus = status as BanAppealStatus;
    }
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const result = await this.listAppealsUc.execute({
      ...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { appeals: result.rows.map(appealToDto), total: result.total };
  }
}
