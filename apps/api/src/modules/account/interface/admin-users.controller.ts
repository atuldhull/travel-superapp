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
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { Roles } from '../../../common/auth';
import { AdminBanUserUseCase } from '../application/admin-ban-user.use-case';
import { AdminListUsersUseCase } from '../application/admin-list-users.use-case';
import { AdminUnbanUserUseCase } from '../application/admin-unban-user.use-case';
import type { AdminUserRow } from '../application/ports/admin-user-query';

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

@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(
    private readonly listUc: AdminListUsersUseCase,
    private readonly banUc: AdminBanUserUseCase,
    private readonly unbanUc: AdminUnbanUserUseCase,
  ) {}

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

  @Post(':id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ban(@Param('id') id: string): Promise<void> {
    await this.banUc.execute(id);
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unban(@Param('id') id: string): Promise<void> {
    await this.unbanUc.execute(id);
  }
}
