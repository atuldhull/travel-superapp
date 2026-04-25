/**
 * Read-side port for the admin user-management list. Wraps a
 * paginated `findMany` + `count` over the `User` table with
 * three optional filters:
 *
 *   - `role`     — single role; absent = all roles.
 *   - `deleted`  — `true` = only soft-deleted, `false` = only
 *                  active, `undefined` = both.
 *   - `q`        — case-insensitive substring of `displayName`.
 *                  Email is intentionally NOT searchable: the
 *                  schema stores `emailHash` (hashed) +
 *                  `emailEncrypted` (pgcrypto), neither of which
 *                  supports substring search. Looking up a user
 *                  by email is a different ops surface (the
 *                  hashing seam) and isn't part of this slice.
 *
 * Pagination: offset-based with `limit` (default 50, cap 200)
 * + `offset` (default 0). Cursor pagination would be cleaner but
 * the list is admin-only + small (~ tens of thousands of rows
 * even at scale) + supports filtering — offset is fine here.
 *
 * Returns `{ rows, total }` so the UI can render "Showing N of
 * M". The shape excludes sensitive columns (`passwordHash`,
 * `mfaSecret`, `emailEncrypted`); `emailHash` is shipped because
 * an admin needs SOMETHING to identify the user (combined with
 * `displayName`).
 *
 * Installed by prompt [IV.18.18.1].
 */
import type { UserRole } from '@prisma/client';

export interface AdminUserRow {
  readonly id: string;
  readonly emailHash: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly mfaEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface AdminUserListInput {
  readonly role?: UserRole;
  readonly deleted?: boolean;
  readonly q?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminUserListResult {
  readonly rows: readonly AdminUserRow[];
  readonly total: number;
}

export interface AdminUserQuery {
  list(input: AdminUserListInput): Promise<AdminUserListResult>;
}

export const ADMIN_USER_QUERY = Symbol('ADMIN_USER_QUERY');
