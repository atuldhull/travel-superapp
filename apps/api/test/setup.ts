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
  BACKUP_CODE_PEPPER: 'e'.repeat(32),
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  // Don't clobber values the caller deliberately set (e.g. CI matrix).
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// ─── Hermetic external integrations ─────────────────────────────────────
// `@nestjs/config` loads `apps/api/.env` (no envFilePath override). That
// file carries a REAL `RESEND_API_KEY`, which flips the mailer to the
// live ResendMailerAdapter during tests → real sends to `@example.com`
// fixtures fail (502) and stub-mailer-dependent flows (magic-link,
// password-reset, reactivation) can't see their emails. Tests MUST be
// hermetic: force the mailer to its stub. Set BEFORE the app boots so
// dotenv (which never overrides an existing process.env key) leaves it.
// Only the mailer key is neutralised — the proven culprit; AI/storage
// keys are intentionally left as-is so currently-green suites are
// unaffected. Installed alongside [POST.2B.* gate hardening].
process.env['RESEND_API_KEY'] = '';
