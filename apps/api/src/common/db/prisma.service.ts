import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';

const log = createLogger('db.prisma');

/**
 * Thin wrapper around `PrismaClient` that plugs into NestJS lifecycle.
 *
 * Callers inject this, not the raw `PrismaClient` — keeps `$queryRaw` /
 * `$executeRaw` paths centralised via `GeoQueries` / `VectorQueries`
 * (CLAUDE.md rule 11).
 *
 * Installed by prompt [III.12.2].
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super({
      datasources: { db: { url: config.get('DATABASE_URL', { infer: true }) } },
      // `query` events would be noisy in prod — gate on log level.
      log: ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    log.info('prisma_connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    log.info('prisma_disconnected');
  }
}
