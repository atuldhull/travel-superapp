/**
 * Port for the trip-balances read-through cache.
 *
 * The expense use-cases depend on this; the Redis-backed
 * `TripBalancesCache` (infrastructure) implements it (CLAUDE.md #10).
 *
 * Extracted by prompt [A1-burndown].
 */
import type { UserBalance } from '../../domain/expense.entity';

export interface TripBalancesCachePort {
  get(key: string): Promise<readonly UserBalance[] | null>;
  set(key: string, value: readonly UserBalance[], ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

/** Nest DI token. */
export const TRIP_BALANCES_CACHE_PORT = Symbol('TripBalancesCachePort');
