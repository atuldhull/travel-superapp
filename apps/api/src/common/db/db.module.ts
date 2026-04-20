import { Global, Module } from '@nestjs/common';
import { GeoQueries } from './geo-queries';
import { PrismaService } from './prisma.service';

/**
 * Global DB module — singleton `PrismaService` + raw-SQL wrappers
 * (`GeoQueries` today, `VectorQueries` + `OutboxQueries` later).
 *
 * Exported as `@Global()` so feature modules inject the service
 * without re-declaring it.
 *
 * Installed by prompt [III.12.2].
 */
@Global()
@Module({
  providers: [PrismaService, GeoQueries],
  exports: [PrismaService, GeoQueries],
})
export class DbModule {}
