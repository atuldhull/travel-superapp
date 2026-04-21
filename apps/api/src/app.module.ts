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
import { JwtAuthGuard, RolesGuard } from './common/auth';
import { DbModule } from './common/db/db.module';
import { EventsModule } from './common/events/events.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlacesModule } from './modules/places/places.module';
import { TripModule } from './modules/trip/trip.module';

/**
 * APP_GUARD order matters — Nest runs them in the order they appear
 * in `providers`, and a guard returning `false` short-circuits the
 * chain. Order here is: rate-limit → authenticate → authorize.
 *
 *   1. `RateLimitGuard` runs on every request (public or not) — we
 *      don't want a flood of unauthenticated traffic to slip past
 *      the budget just because auth would've rejected it anyway.
 *   2. `JwtAuthGuard` verifies the bearer token and attaches
 *      `req.user`. Skipped for `@Public()` routes.
 *   3. `RolesGuard` checks `@Roles(...)` metadata. A no-op when
 *      absent, which is the common case outside admin endpoints.
 */
@Module({
  imports: [
    AppConfigModule.forRoot(),
    DbModule,
    EventsModule,
    RateLimitModule,
    HealthModule,
    IdentityModule,
    TripModule,
    PlacesModule,
    NotificationsModule,
  ],
  providers: [
    AppNestLoggerService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AppNestLoggerService],
})
export class AppModule {}
