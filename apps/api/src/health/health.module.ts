/**
 * Health probes module.
 *
 * V.UX.38 attempted to add an S3HealthIndicator wired through
 * `imports: [MediaModule]`, but evaluating MediaModule eagerly at
 * AppModule load order broke the AuthController DI graph at runtime
 * (RegisterUseCase resolved as `undefined` in tsx-watch). Reverted
 * to the original 3-indicator shape; the /ops dashboard's S3 tile
 * is sourced from a separate /ops/probes use-case in a follow-up.
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpPingIndicator } from './indicators/http-ping.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator, HttpPingIndicator],
})
export class HealthModule {}
