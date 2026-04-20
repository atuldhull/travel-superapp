/**
 * Jest globalSetup-style env seeding.
 *
 * `AppConfigModule.forRoot()` calls `validateEnv(process.env)` at module
 * load time — it will throw if any required var is missing. Tests run
 * in isolation from real dotenv / Doppler, so we seed a minimal valid
 * env BEFORE any test file imports `AppModule`.
 *
 * Loaded via `setupFiles` in `jest.config.cjs` — runs once per worker,
 * before any `describe` / `import` in spec files.
 *
 * Installed by prompt [III.11.0].
 */

const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  // PORT intentionally omitted — e2e tests use Fastify `app.inject()` (no real
  // port is opened). The schema default (3000) is never actually bound.
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://travel:travel_dev@localhost:5432/travel_dev',
  REDIS_URL: 'redis://:redis_dev@localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'travel-test',
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'minio_dev_password',
  MEILI_MASTER_KEY: 'meili_dev_key_change_me_minimum_16_chars',
  RATE_LIMIT_PEPPER: 'c'.repeat(32),
  EMAIL_PEPPER: 'd'.repeat(32),
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  // Don't clobber values the caller deliberately set (e.g. CI matrix).
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
