import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MediaModule } from '../modules/media/media.module';
import { HealthController } from './health.controller';
import { HttpPingIndicator } from './indicators/http-ping.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { S3HealthIndicator } from './indicators/s3.indicator';

@Module({
  // V.UX.38 — MediaModule provides STORAGE_PROVIDER, which the
  // S3 indicator pings on /health/ready. forwardRef is defensive
  // since MediaModule may grow cross-imports later.
  imports: [TerminusModule, forwardRef(() => MediaModule)],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator, HttpPingIndicator, S3HealthIndicator],
})
export class HealthModule {}
