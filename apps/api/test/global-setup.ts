/**
 * Jest globalSetup ([L1]) — self-provisioning hermetic infra.
 *
 * Runs ONCE per `jest` invocation (NOT per worker). Decides whether
 * the integration suite has reachable Postgres + Redis; if not,
 * boots ephemeral Testcontainers and rewrites the env so every
 * worker connects to those instances instead.
 *
 * Why: before [L1], `apps/api/test/setup.ts` set DATABASE_URL +
 * REDIS_URL to localhost defaults; tests then probed reachability
 * and turned themselves into `if (!dbReachable) return` no-ops if
 * the developer hadn't `pnpm dev:up`'d Docker. THAT made suites
 * green when they ran nothing — the single biggest reliability bug
 * the playbook called out.
 *
 * The new posture: tests ALWAYS have real infra. CI gets it from
 * GitHub service containers + env vars; local devs get it from
 * `pnpm dev:up` Docker OR from Testcontainers if Docker compose
 * isn't running. No silent skips.
 *
 * Per-worker DATABASE isolation: `apps/api/test/setup.ts` reads
 * `JEST_WORKER_ID` and points DATABASE_URL at database `test_w<ID>`.
 * THIS file (globalSetup) creates each worker database + runs `prisma
 * migrate deploy` against it before any worker starts. Workers can
 * then run in PARALLEL without `--runInBand` because they're
 * insulated at the database level.
 *
 * Why databases and not schemas: PostGIS is not relocatable — `CREATE
 * EXTENSION postgis` always installs into `public`, whatever the
 * session search_path is. Prisma's `?schema=test_wN` sets search_path
 * to that schema alone, so the unqualified `geography(Point, 4326)`
 * in the init migration cannot resolve and every migrate-deploy dies
 * with `type "geography" does not exist`. Giving each worker its own
 * database gives each its own `public`, so the extension and the
 * tables land in the same place.
 */
import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

/** Swap the database name in a Postgres URL, forcing `schema=public`
 *  (each worker database has its own `public`). */
function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  parsed.searchParams.set('schema', 'public');
  return parsed.toString();
}

interface InfraEndpoints {
  readonly postgresUrl: string;
  readonly redisUrl: string;
  readonly containers: readonly StartedTestContainer[];
}

const REGISTRY_KEY = '__APP_TESTCONTAINERS__' as const;

interface GlobalRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [REGISTRY_KEY]?: { containers: any[] };
}

/** Quick TCP-probe — returns true if a server is accepting on
 *  `host:port` within `timeoutMs`. Used to decide between
 *  "developer already has Docker compose up" vs "boot
 *  Testcontainers ourselves." */
async function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok: boolean): void => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('error', () => done(false));
    sock.once('timeout', () => done(false));
    sock.connect(port, host, () => done(true));
  });
}

async function provision(): Promise<InfraEndpoints> {
  // Honour explicit CI env first — if DATABASE_URL is already set by
  // GitHub Actions services or by the developer's shell, trust it.
  const haveDbUrl = process.env['DATABASE_URL'];
  const haveRedisUrl = process.env['REDIS_URL'];

  // Probe the standard local-dev endpoints (Docker compose maps
  // Postgres to :5433 + Redis to :6380 on this project).
  const pgOpen =
    haveDbUrl || (await isPortOpen('127.0.0.1', 5433)) || (await isPortOpen('127.0.0.1', 5432));
  const redisOpen =
    haveRedisUrl || (await isPortOpen('127.0.0.1', 6380)) || (await isPortOpen('127.0.0.1', 6379));

  const containers: StartedTestContainer[] = [];
  let postgresUrl = haveDbUrl ?? '';
  let redisUrl = haveRedisUrl ?? '';

  if (!pgOpen) {
    process.stdout.write('[global-setup] Postgres not reachable; booting Testcontainer…\n');
    const pg = await new GenericContainer('postgis/postgis:16-3.4-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'travel',
        POSTGRES_PASSWORD: 'travel_dev',
        POSTGRES_DB: 'travel_dev',
      })
      .withStartupTimeout(60_000)
      .start();
    containers.push(pg);
    const host = pg.getHost();
    const port = pg.getMappedPort(5432);
    postgresUrl = `postgresql://travel:travel_dev@${host}:${port}/travel_dev?schema=public`;
  } else if (!postgresUrl) {
    // Local Docker is up but env not set — derive from the probed port.
    const port = (await isPortOpen('127.0.0.1', 5433)) ? 5433 : 5432;
    postgresUrl = `postgresql://travel:travel_dev@127.0.0.1:${port}/travel_dev?schema=public`;
  }

  if (!redisOpen) {
    process.stdout.write('[global-setup] Redis not reachable; booting Testcontainer…\n');
    const redis = await new GenericContainer('redis:7.4-alpine')
      .withExposedPorts(6379)
      .withStartupTimeout(30_000)
      .start();
    containers.push(redis);
    redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  } else if (!redisUrl) {
    const port = (await isPortOpen('127.0.0.1', 6380)) ? 6380 : 6379;
    redisUrl = `redis://:redis_dev@127.0.0.1:${port}`;
  }

  return { postgresUrl, redisUrl, containers };
}

export default async function globalSetup(): Promise<void> {
  const infra = await provision();
  process.env['DATABASE_URL'] = infra.postgresUrl;
  process.env['DIRECT_URL'] = infra.postgresUrl;
  process.env['REDIS_URL'] = infra.redisUrl;

  // Per-worker database setup. `JEST_WORKER_ID` isn't set in
  // globalSetup itself, so we precreate every database the workers
  // might use. The default jest worker pool is min(CPU, testFiles);
  // 8 covers all realistic cases. Idempotent — an existing database
  // is left alone and just rolled forward by `migrate deploy`.
  const apiRoot = path.resolve(__dirname, '..');
  const MAX_WORKERS = 8;

  // `CREATE DATABASE` can't run inside a transaction, and there's no
  // `IF NOT EXISTS` for it, so probe pg_database first. The admin
  // connection targets whatever database the base URL names.
  const admin = new PrismaClient({ datasources: { db: { url: infra.postgresUrl } } });
  try {
    for (let w = 1; w <= MAX_WORKERS; w++) {
      const database = `test_w${w}`;
      const exists = await admin.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) AS count FROM pg_database WHERE datname = ${database}`;
      if ((exists[0]?.count ?? 0n) === 0n) {
        process.stdout.write(`[global-setup] creating database ${database}\n`);
        await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
      }
    }
  } finally {
    await admin.$disconnect();
  }

  for (let w = 1; w <= MAX_WORKERS; w++) {
    const database = `test_w${w}`;
    const url = withDatabase(infra.postgresUrl, database);
    process.stdout.write(`[global-setup] migrating database ${database}\n`);
    execSync('pnpm prisma migrate deploy', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: 'pipe',
    });
  }

  // Stash the started containers on globalThis so globalTeardown
  // can stop them cleanly.
  (globalThis as GlobalRegistry)[REGISTRY_KEY] = { containers: [...infra.containers] };
}
