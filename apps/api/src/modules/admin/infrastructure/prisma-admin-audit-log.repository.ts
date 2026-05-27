/**
 * V.UX.36 — Prisma adapter for the admin audit log.
 *
 * `record()` inserts. `list()` filters by actorId / targetType /
 * targetId / action; default sort is newest-first; offset+limit
 * pagination clamped at the use-case layer.
 *
 * Append-only: no update/delete methods exist on this surface by
 * design.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, AdminAuditLog as PrismaAdminAuditLog } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AdminAuditLog } from '../domain/admin-audit-log.entity';
import type {
  AdminAuditLogRepository,
  ListAdminAuditLogQuery,
  ListAdminAuditLogResult,
  RecordAdminAuditLogInput,
} from '../application/ports/admin-audit-log.repository';
import {
  SLACK_ADMIN_NOTIFIER,
  type SlackAdminNotifierPort,
} from '../application/ports/slack-admin-notifier.port';

@Injectable()
export class PrismaAdminAuditLogRepository implements AdminAuditLogRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SLACK_ADMIN_NOTIFIER) private readonly slack: SlackAdminNotifierPort,
  ) {}

  async record(input: RecordAdminAuditLogInput): Promise<AdminAuditLog> {
    const row = await this.prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        context: (input.context ?? null) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      },
    });
    // [S-E6] Fire-and-forget Slack ping for ops visibility on critical
    // actions. The notifier swallows its own errors so the audit write
    // never fails on webhook trouble. `void` rather than `await` because
    // the caller shouldn't wait for the webhook to land.
    void this.slack.notify({
      actorId: row.actorId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      context: (row.context as Record<string, unknown> | null) ?? null,
    });
    return toDomain(row);
  }

  async list(query: ListAdminAuditLogQuery): Promise<ListAdminAuditLogResult> {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
      ...(query.targetType !== undefined ? { targetType: query.targetType } : {}),
      ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
      ...(query.actions && query.actions.length > 0
        ? { action: { in: [...query.actions] } }
        : query.action !== undefined
          ? { action: query.action }
          : {}),
    };
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { rows: rows.map(toDomain), total };
  }
}

function toDomain(row: PrismaAdminAuditLog): AdminAuditLog {
  return {
    id: row.id,
    actorId: row.actorId,
    targetType: row.targetType,
    targetId: row.targetId,
    action: row.action,
    context: (row.context as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}
