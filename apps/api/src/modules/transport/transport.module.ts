/**
 * Transport feature module. Clean-hex + decorator-of-DI cache —
 * same shape Weather/Stays/Food/Places/Events use. Sixth consumer
 * of the `TypedRedisCache<T>` extraction.
 *
 *   controller (interface)
 *     → GetRoutesUseCase (application)
 *       → ROUTING_PROVIDER port
 *         ← CachedRoutingProvider (infrastructure)
 *             ├── MockRoutingProvider (haversine fixture)
 *             └── ROUTING_CACHE port → RedisRoutingCache
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Module } from '@nestjs/common';
import { GetRoutesUseCase } from './application/get-routes.use-case';
import { ROUTING_CACHE } from './application/ports/routing-cache';
import { ROUTING_PROVIDER } from './application/ports/routing-provider';
import { CachedRoutingProvider } from './infrastructure/cached-routing-provider';
import { MockRoutingProvider } from './infrastructure/mock-routing-provider';
import { RedisRoutingCache } from './infrastructure/redis-routing-cache';
import { TransportController } from './interface/transport.controller';

@Module({
  controllers: [TransportController],
  providers: [
    MockRoutingProvider,
    { provide: ROUTING_CACHE, useClass: RedisRoutingCache },
    { provide: ROUTING_PROVIDER, useClass: CachedRoutingProvider },
    GetRoutesUseCase,
  ],
  exports: [ROUTING_PROVIDER, GetRoutesUseCase],
})
export class TransportModule {}
