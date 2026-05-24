/**
 * Jest globalTeardown ([L1]) — companion to global-setup.ts. Stops
 * any Testcontainers started during globalSetup. Per-worker schemas
 * are intentionally LEFT in place so a follow-up local run doesn't
 * re-pay the migrate-deploy cost; they're test_wN scoped, idempotent,
 * and rolled forward by `prisma migrate deploy` on the next setup.
 *
 * Installed by [L1].
 */
import type { StartedTestContainer } from 'testcontainers';

const REGISTRY_KEY = '__APP_TESTCONTAINERS__' as const;

interface GlobalRegistry {
  [REGISTRY_KEY]?: { containers: StartedTestContainer[] };
}

export default async function globalTeardown(): Promise<void> {
  const reg = (globalThis as GlobalRegistry)[REGISTRY_KEY];
  if (!reg || reg.containers.length === 0) return;
  await Promise.allSettled(reg.containers.map((c) => c.stop({ timeout: 10_000 })));
}
