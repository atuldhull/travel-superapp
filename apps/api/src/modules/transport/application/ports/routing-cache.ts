/**
 * Port for caching routing results. Sixth consumer of the
 * cache-around-port pattern (Weather + Stays + Food + Places +
 * Events + now Transport).
 *
 * Installed by prompt [IV.18.10.1].
 */
import type { RouteLeg } from '../../domain/route-leg.entity';

export interface RoutingCache {
  get(key: string): Promise<readonly RouteLeg[] | null>;
  set(key: string, value: readonly RouteLeg[], ttlSeconds: number): Promise<void>;
}

export const ROUTING_CACHE = Symbol('RoutingCache');
