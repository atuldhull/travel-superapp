/**
 * Root NestJS module for apps/api.
 *
 * Imports the validated global config module from `@app/config`, registers
 * the Pino-backed NestJS logger service from `@app/logger`, and mounts
 * the health router for `/health/*` probes.
 *
 * Feature modules (identity, trip, places, …) land in their own
 * `[III.11.x]` / `[IV.18.2.x]` prompts and will be added to the
 * `imports: [...]` array here.
 *
 * Installed by prompt [III.11.0].
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '@app/config';
import { AppNestLoggerService } from '@app/logger';
import { DbModule } from './common/db/db.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule.forRoot(), DbModule, RateLimitModule, HealthModule],
  providers: [
    AppNestLoggerService,
    // Rate-limit every route by default. Routes with @SkipThrottle() or
    // no @Throttle() still get the `default` bucket (60/min/user+ip).
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AppNestLoggerService],
})
export class AppModule {}
