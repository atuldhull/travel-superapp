/**
 * Transport feature module. Clean-hex + decorator-of-DI cache —
 * same shape Weather/Stays/Food/Places/Events use.
 *
 *   controller (interface)
 *     → GetRoutesUseCase (application)          [IV.18.10.1]
 *       → ROUTING_PROVIDER port
 *         ← CachedRoutingProvider (infrastructure)
 *             ├── MockRoutingProvider (haversine fixture)
 *             └── ROUTING_CACHE port → RedisRoutingCache
 *     → GetNavigationUseCase (application)      [live-navigation]
 *       → NAVIGATION_PROVIDER port
 *         ← CompositeNavigationProvider
 *             ├── OsrmNavigationProvider  (real road geometry, $0)
 *             └── MockNavigationProvider  (deterministic fallback)
 *       → TRAFFIC_PROVIDER port
 *         ← CompositeTrafficProvider
 *             ├── TomTomTrafficProvider   (live, only if keyed)
 *             └── MockTrafficProvider     (deterministic fallback)
 *
 * The OSRM base URL has a safe public default; the TomTom key is
 * optional — when absent the composite uses the mock and the client
 * just sees `trafficSource: 'mock'`. Same env-gated optional-provider
 * pattern as POST.3/4/9.
 *
 * Installed by prompt [IV.18.10.1]; navigation added for the
 * live-navigation feature.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_CLOCK } from '@app/clock';
import type { Env } from '@app/config';
import { GetRoutesUseCase } from './application/get-routes.use-case';
import { GetNavigationUseCase } from './application/get-navigation.use-case';
import { ROUTING_CACHE } from './application/ports/routing-cache';
import { ROUTING_PROVIDER } from './application/ports/routing-provider';
import { NAVIGATION_PROVIDER } from './application/ports/navigation-provider';
import { TRAFFIC_PROVIDER } from './application/ports/traffic-provider';
import { CachedRoutingProvider } from './infrastructure/cached-routing-provider';
import { MockRoutingProvider } from './infrastructure/mock-routing-provider';
import { RedisRoutingCache } from './infrastructure/redis-routing-cache';
import { MockNavigationProvider } from './infrastructure/mock-navigation-provider';
import { OsrmNavigationProvider } from './infrastructure/osrm-navigation-provider';
import { CompositeNavigationProvider } from './infrastructure/composite-navigation-provider';
import { MockTrafficProvider } from './infrastructure/mock-traffic-provider';
import { TomTomTrafficProvider } from './infrastructure/tomtom-traffic-provider';
import { CompositeTrafficProvider } from './infrastructure/composite-traffic-provider';
import { TransportController } from './interface/transport.controller';

@Module({
  controllers: [TransportController],
  providers: [
    // ── Mode-fit routing (one cost/duration per transport mode) ──
    MockRoutingProvider,
    { provide: ROUTING_CACHE, useClass: RedisRoutingCache },
    { provide: ROUTING_PROVIDER, useClass: CachedRoutingProvider },
    GetRoutesUseCase,

    // ── Live navigation (drawable road lines + traffic) ──
    MockNavigationProvider,
    {
      provide: OsrmNavigationProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new OsrmNavigationProvider(config.get('OSRM_BASE_URL', { infer: true }), SYSTEM_CLOCK),
    },
    {
      provide: NAVIGATION_PROVIDER,
      inject: [OsrmNavigationProvider, MockNavigationProvider],
      useFactory: (osrm: OsrmNavigationProvider, mock: MockNavigationProvider) =>
        new CompositeNavigationProvider(osrm, mock),
    },
    MockTrafficProvider,
    {
      // null when no key — CompositeTrafficProvider then always mocks.
      provide: TomTomTrafficProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const key = config.get('TOMTOM_API_KEY', { infer: true });
        return key ? new TomTomTrafficProvider(key, SYSTEM_CLOCK) : null;
      },
    },
    {
      provide: TRAFFIC_PROVIDER,
      inject: [MockTrafficProvider, TomTomTrafficProvider],
      useFactory: (mock: MockTrafficProvider, tomtom: TomTomTrafficProvider | null) =>
        new CompositeTrafficProvider(mock, tomtom),
    },
    GetNavigationUseCase,
  ],
  exports: [ROUTING_PROVIDER, GetRoutesUseCase, NAVIGATION_PROVIDER, GetNavigationUseCase],
})
export class TransportModule {}
