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
 * Read replicas ([R4]):
 *   - Primary connects via `DATABASE_URL` (pooled in staging/prod, see
 *     [Q1] PgBouncer split).
 *   - When `DATABASE_URL_READONLY` is set, a SECOND PrismaClient
 *     connects to the read replica. Use-cases that explicitly want a
 *     read-near-replica read call `prisma.$readReplica()` to get that
 *     client; everything else stays on the primary.
 *   - When `DATABASE_URL_READONLY` is unset, `$readReplica()` returns
 *     `this` — same primary client. Callers don't need to change shape
 *     for the no-replica case.
 *
 * When to use $readReplica:
 *   • Hot reads that DON'T require read-after-write consistency
 *     (e.g. /api/v1/places/featured, /api/v1/feed/public).
 *   • Reads scoped to a single region during multi-region operation
 *     ([Q9] failover; the replica lives in the surviving region).
 *
 * When NOT to use $readReplica:
 *   • Any read inside `$transaction` (the replica isn't part of the tx).
 *   • Read-after-write of the same row (replica lag = stale data).
 *   • Writes — they always go to the primary.
 *
 * Installed by prompt [III.12.2]. Read-replica accessor added by [R4].
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly replicaClient: PrismaClient | null;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super({
      datasources: { db: { url: config.get('DATABASE_URL', { infer: true }) } },
      // `query` events would be noisy in prod — gate on log level.
      log: ['warn', 'error'],
    });

    // Nest's `infer: true` widens optional URL fields to `string | number
    // | true`. We know the Zod schema constrains it to `string | undefined`;
    // narrow explicitly here.
    const readonlyUrl = config.get('DATABASE_URL_READONLY', { infer: true }) as string | undefined;
    if (readonlyUrl) {
      this.replicaClient = new PrismaClient({
        datasources: { db: { url: readonlyUrl } },
        log: ['warn', 'error'],
      });
    } else {
      this.replicaClient = null;
    }
  }

  /**
   * Read-near accessor. Returns the read-replica PrismaClient when
   * `DATABASE_URL_READONLY` is configured; otherwise returns `this`
   * (the primary). Either way the returned value is a PrismaClient,
   * so callers don't branch on env.
   */
  $readReplica(): PrismaClient {
    return this.replicaClient ?? this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    if (this.replicaClient) {
      await this.replicaClient.$connect();
      log.info('prisma_connected_with_replica');
    } else {
      log.info('prisma_connected');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    if (this.replicaClient) {
      await this.replicaClient.$disconnect();
    }
    log.info('prisma_disconnected');
  }
}
