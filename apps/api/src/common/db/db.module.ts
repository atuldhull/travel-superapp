import { Global, Module } from '@nestjs/common';
import { GeoQueries } from './geo-queries';
import { PrismaService } from './prisma.service';
import { VectorQueries } from './vector-queries';

/**
 * Global DB module — singleton `PrismaService` + raw-SQL wrappers
 * (`GeoQueries` for PostGIS, `VectorQueries` for pgvector; an
 * `OutboxQueries` wrapper will land when the event-bus outbox does).
 *
 * Exported as `@Global()` so feature modules inject the service
 * without re-declaring it.
 *
 * Installed by prompt [III.12.2]; extended by [III.12.3].
 */
@Global()
@Module({
  providers: [PrismaService, GeoQueries, VectorQueries],
  exports: [PrismaService, GeoQueries, VectorQueries],
})
export class DbModule {}
