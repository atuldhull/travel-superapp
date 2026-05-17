/**
 * Navigation provider that tries the real OSRM adapter and falls back
 * to the deterministic mock on ANY failure (timeout, non-Ok, offline,
 * test env). This is what guarantees the LiveNavMap always renders a
 * route — the user-visible promise of the feature.
 *
 * Test/offline posture: when `NODE_ENV === 'test'` the network is
 * skipped entirely and the mock is used directly, so e2e specs are
 * deterministic and never flake on the public demo server.
 *
 * Mirrors the `CachedRoutingProvider` decorator shape already used in
 * this module.
 *
 * Installed for the live-navigation feature.
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type { RawNavRoute } from '../domain/nav-route.entity';
import type { NavigationInput, NavigationProvider } from '../application/ports/navigation-provider';
import { MockNavigationProvider } from './mock-navigation-provider';
import { OsrmNavigationProvider } from './osrm-navigation-provider';

@Injectable()
export class CompositeNavigationProvider implements NavigationProvider {
  private readonly logger: AppLogger = createLogger('transport.nav.composite');

  constructor(
    private readonly osrm: OsrmNavigationProvider,
    private readonly mock: MockNavigationProvider,
  ) {}

  async getRoutes(input: NavigationInput): Promise<readonly RawNavRoute[]> {
    if (process.env['NODE_ENV'] === 'test') {
      return this.mock.getRoutes(input);
    }
    try {
      const real = await this.osrm.getRoutes(input);
      if (real.length > 0) return real;
      this.logger.warn({}, 'osrm_empty_falling_back_to_mock');
    } catch {
      // OSRM already logged the cause at warn; degrade silently here.
    }
    return this.mock.getRoutes(input);
  }
}
