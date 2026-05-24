/**
 * Prisma + GeoQueries adapter for `SosEventRepository`. `create`
 * goes through `GeoQueries.insertSosEvent` (PostGIS column);
 * `listForUser` + `resolve` are direct Prisma delegate calls (no
 * geo-column access needed for either).
 *
 * `resolve` uses `updateMany` + `count === 1` gate so the
 * owner-scope + unresolved-only filter runs atomically. A repeat
 * resolve returns count=0 → `null` → 404 at the use-case layer.
 *
 * Installed by prompt [IV.18.11.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { SosEvent as PrismaSosEvent } from '@prisma/client';
import { GeoQueries } from '../../../common/db/geo-queries';
import { PrismaService } from '../../../common/db/prisma.service';
import { SosEvent } from '../domain/sos-event.entity';
import type {
  AdminResolveSosInput,
  AdminSosListInput,
  AdminSosListResult,
  CreateSosInput,
  ResolveSosInput,
  SosEventRepository,
} from '../application/ports/sos-event.repository';

@Injectable()
export class PrismaSosEventRepository implements SosEventRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async create(input: CreateSosInput): Promise<SosEvent> {
    const row = await this.geo.insertSosEvent(input);
    return toDomain(row);
  }

  async listForUser(userId: string, limit: number): Promise<readonly SosEvent[]> {
    const rows = await this.prisma.sosEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async resolve(input: ResolveSosInput): Promise<SosEvent | null> {
    const now = new Date();
    const result = await this.prisma.sosEvent.updateMany({
      where: { id: input.id, userId: input.userId, resolvedAt: null },
      data: { resolvedAt: now, resolutionNote: input.note },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.sosEvent.findUnique({ where: { id: input.id } });
    return row ? toDomain(row) : null;
  }

  async adminList(input: AdminSosListInput): Promise<AdminSosListResult> {
    const where =
      input.status === 'active'
        ? { resolvedAt: null }
        : input.status === 'resolved'
          ? { resolvedAt: { not: null } }
          : {};
    const [rows, total] = await Promise.all([
      this.prisma.sosEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.sosEvent.count({ where }),
    ]);
    return { rows: rows.map(toDomain), total };
  }

  async adminResolve(input: AdminResolveSosInput): Promise<SosEvent | null> {
    const now = new Date();
    const result = await this.prisma.sosEvent.updateMany({
      // No userId scope — admin can resolve any active event.
      where: { id: input.id, resolvedAt: null },
      data: { resolvedAt: now, resolutionNote: input.note },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.sosEvent.findUnique({ where: { id: input.id } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: PrismaSosEvent): SosEvent {
  return SosEvent.fromPersistence({
    id: row.id,
    userId: row.userId,
    trigger: row.trigger,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt,
  });
}
