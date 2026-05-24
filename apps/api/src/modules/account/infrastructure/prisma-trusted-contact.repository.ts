/**
 * Prisma adapter for TrustedContactRepository (V.UX.13). No
 * PostGIS / vector columns — direct delegate.
 *
 * Installed by prompt [V.UX.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TrustedContact as PrismaTrustedContact } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import { TrustedContact } from '../domain/trusted-contact.entity';
import type {
  CreateTrustedContactInput,
  TrustedContactRepository,
} from '../application/ports/trusted-contact.repository';

@Injectable()
export class PrismaTrustedContactRepository implements TrustedContactRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<readonly TrustedContact[]> {
    const rows = await this.prisma.trustedContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async countForUser(userId: string): Promise<number> {
    return this.prisma.trustedContact.count({ where: { userId } });
  }

  async create(input: CreateTrustedContactInput): Promise<TrustedContact> {
    const row = await this.prisma.trustedContact.create({
      data: {
        userId: input.userId,
        name: input.name,
        phone: input.phone,
        email: input.email,
      },
    });
    return toDomain(row);
  }

  async deleteForOwner(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.trustedContact.deleteMany({
      where: { id, userId },
    });
    return result.count === 1;
  }
}

function toDomain(row: PrismaTrustedContact): TrustedContact {
  return TrustedContact.fromPersistence({
    id: row.id,
    userId: row.userId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
