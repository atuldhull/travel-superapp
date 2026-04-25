/**
 * `@Global()` so MetricsService is injectable anywhere without
 * each consumer module importing this one. The service is a pure
 * singleton — Nest's DI graph treats it as such, and the
 * static-registry pattern on `TypedRedisCache` doesn't need DI
 * at all to surface cache stats. Module exists primarily to
 * mount the `/metrics` controller.
 *
 * Installed by prompt [IV.18.10.6].
 */
import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
