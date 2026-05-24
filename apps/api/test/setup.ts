/**
 * Per-worker test setup. Runs ONCE per jest worker process before
 * any spec file imports `AppModule`.
 *
 * Three responsibilities:
 *
 *   1. Seed the minimum env that `AppConfigModule.forRoot()`'s Zod
 *      validator requires.
 *   2. Per-worker DATABASE_URL — append `?schema=test_w<JEST_WORKER_ID>`
 *      ([L1]) so parallel workers don't collide on the same rows.
 *      `apps/api/test/global-setup.ts` precreates all 8 schemas +
 *      runs migrate-deploy on each. THIS isolation is what lets the
 *      api suite drop --runInBand.
 *   3. Hermetic external integrations — neutralise the live mailer
 *      key so a real RESEND_API_KEY in `.env` can't smuggle into
 *      tests.
 *
 * `apps/api/test/global-setup.ts` runs BEFORE this file (it's
 * jest's `globalSetup`) and decides whether infra comes from
 * - GitHub Actions service containers (CI)
 * - local Docker compose (`pnpm dev:up`)
 * - Testcontainers ephemeral instances ([L1] fallback)
 *
 * Installed by [III.11.0]; per-worker iso added in [L1].
 */

const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  // DATABASE_URL + REDIS_URL come from globalSetup ([L1]) which writes
  // the right value into process.env BEFORE this file loads. The
  // fallback below only matters when a user runs jest WITHOUT
  // globalSetup (rare — e.g. `jest --testPathPattern=foo` for a pure
  // unit spec that doesn't need infra).
  DATABASE_URL: 'postgresql://travel:travel_dev@127.0.0.1:5433/travel_dev',
  REDIS_URL: 'redis://:redis_dev@127.0.0.1:6380',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'travel-test',
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'minio_dev_password',
  MEILI_MASTER_KEY: 'meili_dev_key_change_me_minimum_16_chars',
  RATE_LIMIT_PEPPER: 'c'.repeat(32),
  EMAIL_PEPPER: 'd'.repeat(32),
  BACKUP_CODE_PEPPER: 'e'.repeat(32),
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// ─── Per-worker schema isolation ([L1]) ─────────────────────────────
// JEST_WORKER_ID is `1` for the first worker; increments per parallel
// worker. Append/override `?schema=test_w<id>` so every worker hits
// its own Postgres schema. globalSetup migrated all 8 schemas
// up-front; this just points the worker at the right one.
//
// DIRECT_URL mirrors DATABASE_URL — Prisma uses the latter for the
// runtime pool + the former for migrations.
const workerId = process.env['JEST_WORKER_ID'] ?? '1';
const schemaName = `test_w${workerId}`;

function withSchema(url: string, schema: string): string {
  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('schema', schema);
  return `${base}?${params.toString()}`;
}

process.env['DATABASE_URL'] = withSchema(process.env['DATABASE_URL']!, schemaName);
process.env['DIRECT_URL'] = withSchema(
  process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']!,
  schemaName,
);

// ─── Hermetic external integrations ─────────────────────────────────
// `@nestjs/config` loads `apps/api/.env` (no envFilePath override). That
// file carries a REAL `RESEND_API_KEY`, which flips the mailer to the
// live ResendMailerAdapter during tests → real sends to `@example.com`
// fixtures fail (502) and stub-mailer-dependent flows can't see their
// emails. Tests MUST be hermetic: force the mailer to its stub.
process.env['RESEND_API_KEY'] = '';
