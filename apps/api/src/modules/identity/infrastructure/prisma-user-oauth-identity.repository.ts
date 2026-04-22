/**
 * Prisma adapter for `UserOAuthIdentityRepository`. Direct Prisma
 * delegate calls — no raw SQL needed.
 *
 * Installed by prompt [III.13.2.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { UserOAuthIdentity as PrismaUserOAuthIdentity } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  LinkIdentityInput,
  UserOAuthIdentity,
  UserOAuthIdentityRepository,
} from '../application/ports/user-oauth-identity.repository';

@Injectable()
export class PrismaUserOAuthIdentityRepository implements UserOAuthIdentityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByProviderUser(
    provider: string,
    providerUserId: string,
  ): Promise<UserOAuthIdentity | null> {
    const row = await this.prisma.userOAuthIdentity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
    return row ? toDomain(row) : null;
  }

  async link(input: LinkIdentityInput): Promise<UserOAuthIdentity> {
    const row = await this.prisma.userOAuthIdentity.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        providerUserId: input.providerUserId,
        providerEmail: input.providerEmail,
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: PrismaUserOAuthIdentity): UserOAuthIdentity {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerUserId: row.providerUserId,
    providerEmail: row.providerEmail,
    linkedAt: row.linkedAt,
  };
}
