/**
 * List users with optional filters for admin moderation.
 *
 * Default `limit` 50, cap 200 — same shape as every other "list
 * mine" / "list mod queue" surface in the codebase.
 *
 * Installed by prompt [IV.18.18.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import {
  ADMIN_USER_QUERY,
  type AdminUserListResult,
  type AdminUserQuery,
} from './ports/admin-user-query';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface AdminListUsersCommand {
  readonly role?: UserRole;
  readonly deleted?: boolean;
  readonly q?: string;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AdminListUsersUseCase {
  constructor(@Inject(ADMIN_USER_QUERY) private readonly query: AdminUserQuery) {}

  async execute(cmd: AdminListUsersCommand): Promise<AdminUserListResult> {
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const offset = cmd.offset === undefined ? 0 : Math.max(0, Math.floor(cmd.offset));
    return this.query.list({
      ...(cmd.role !== undefined ? { role: cmd.role } : {}),
      ...(cmd.deleted !== undefined ? { deleted: cmd.deleted } : {}),
      ...(cmd.q !== undefined ? { q: cmd.q } : {}),
      limit,
      offset,
    });
  }
}
