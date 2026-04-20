/**
 * Prisma adapter for `UserRepository`. Minimal surface for this slice
 * — register, findByEmailHash, findById. Profile updates, MFA, OAuth
 * linkage land later.
 *
 * Soft-deleted users (`deletedAt != null`) are treated as absent —
 * ADR-010 says login must not resurrect an anonymised account.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  CreateUserInput,
  UserRecord,
  UserRepository,
  UserRole,
} from '../application/ports/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    const row = await this.prisma.user.create({
      data: {
        emailHash: input.emailHash,
        emailEncrypted: input.emailEncrypted,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
      },
    });
    return toDomain(row);
  }

  async findByEmailHash(emailHash: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { emailHash } });
    if (!row || row.deletedAt !== null) return null;
    return toDomain(row);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row || row.deletedAt !== null) return null;
    return toDomain(row);
  }

  async setMfaSecret(userId: string, base32Secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: base32Secret },
    });
  }

  async confirmMfa(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  async disableMfa(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
  }
}

function toDomain(row: PrismaUser): UserRecord {
  return {
    id: row.id,
    emailHash: row.emailHash,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    displayName: row.displayName,
    mfaEnabled: row.mfaEnabled,
    mfaSecret: row.mfaSecret,
  };
}
