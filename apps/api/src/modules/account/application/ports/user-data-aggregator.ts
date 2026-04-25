/**
 * Port for aggregating every user-scoped row in the system. The
 * adapter implements one big "owner-scoped fan-out" query — each
 * section is fetched in parallel via `Promise.all` so the whole
 * bundle returns in roughly the slowest-section's time, not the
 * sum.
 *
 * Why a port: keeps the application/use-case layer free of Prisma
 * imports + cross-module Prisma reads. A future swap (e.g.
 * sharded tenant DB, per-section read-replica routing) lands as a
 * second adapter without touching the use-case.
 *
 * The adapter MUST throw if any section query fails — partial
 * exports would silently under-disclose, which defeats the point
 * of the endpoint. The use-case wraps the call to attach the
 * `metadata` envelope; failures bubble up as 500.
 *
 * Installed by prompt [IV.18.16.1].
 */
import type { UserDataExport } from '../../domain/user-data-export.entity';

export type UserDataBundle = Omit<UserDataExport, 'metadata'>;

export interface UserDataAggregator {
  /**
   * Returns the caller's full data bundle. Returns `null` if the
   * user row itself is missing — the use-case maps that to 404.
   */
  aggregateForUser(userId: string): Promise<UserDataBundle | null>;
}

export const USER_DATA_AGGREGATOR = Symbol('USER_DATA_AGGREGATOR');
