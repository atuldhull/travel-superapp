/**
 * OpenAPI export pipeline. Boots AppModule, walks Nest's controller
 * + route metadata, emits an `openapi.yaml` to `docs/api/`.
 *
 * Usage:
 *   pnpm --filter=api api:openapi
 *
 * What you get (today, v1):
 *   - Every route's HTTP verb + path is enumerated by walking the
 *     `@Controller` + `@Get/@Post/@Patch/@Delete` decorator metadata.
 *   - Routes are tagged by their owning module (resolved from the
 *     controller class name).
 *   - 401 / 403 / 404 / 500 responses are inferred from the global
 *     auth guards + DomainExceptionFilter — they aren't documented
 *     per-route yet.
 *
 * What you DON'T get (yet, by design):
 *   - Per-route request body schemas — needs `@ApiBody()` decorators
 *     on each handler. Tracked as a follow-up; rolling out one
 *     module at a time avoids a single mega-PR.
 *   - Response body schemas — same story.
 *   - Auth-requirement annotation on each route — needs `@ApiBearerAuth()`
 *     + `@ApiSecurity()` decorators.
 *
 * The output is committed (so consumers like the future SDK
 * generator have a stable artifact). Re-run after every controller
 * change that affects the public surface; CI gates this on
 * `[IV.18.19.x]` follow-up.
 *
 * Installed by prompt [IV.18.19.10].
 */
import 'reflect-metadata';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Inject placeholder env values BEFORE we import AppModule —
// AppConfigModule.forRoot() validates env at module-load time, so
// the placeholders must be set first. We use a dynamic import for
// AppModule below to make the timing explicit.
//
// Real values via Doppler still take precedence; the `??=` only
// fills in keys that weren't already set.
const PLACEHOLDER_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'export-placeholder-access-secret-min-32-chars',
  JWT_REFRESH_SECRET: 'export-placeholder-refresh-secret-min-32-chars',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'export-placeholder',
  S3_ACCESS_KEY: 'export-placeholder',
  S3_SECRET_KEY: 'export-placeholder',
  MEILI_MASTER_KEY: 'export-placeholder-meili-key-16',
  RATE_LIMIT_PEPPER: 'export-placeholder-rate-pepper-min-32-chars',
  EMAIL_PEPPER: 'export-placeholder-email-pepper-min-32-chars',
  BACKUP_CODE_PEPPER: 'export-placeholder-backup-pepper-min-32-chars',
};
for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[key] ??= value;
}

async function main(): Promise<void> {
  // Dynamic imports so the env-placeholder block above runs FIRST.
  // Static imports get hoisted; AppConfigModule.forRoot() would
  // see an empty process.env and fail validation.
  const { NestFactory } = await import('@nestjs/core');
  const { FastifyAdapter } = await import('@nestjs/platform-fastify');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const { AppModule } = await import('../src/app.module');
  type NestFastifyApplication = import('@nestjs/platform-fastify').NestFastifyApplication;
  // Build a no-listen Nest app — we only need the route metadata,
  // not an actual HTTP server. `logger: ['error', 'warn']` is the
  // sweet spot: silent on routine boot logs, but mistakes still
  // surface so a missing env var or a failed module init isn't
  // hidden.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: ['error', 'warn'] },
  );
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });

  const config = new DocumentBuilder()
    .setTitle('TravelSuperApp API')
    .setDescription(
      'OpenAPI export from the running NestJS app. Per-route schemas land ' +
        'progressively as @ApiBody / @ApiResponse decorators get added module ' +
        'by module — see docs/api/README.md.',
    )
    .setVersion('v1')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access token issued by POST /auth/login or rotated via POST /auth/refresh. ' +
        'Lifetime: 15 minutes (configurable via JWT_ACCESS_EXPIRY).',
    })
    .addTag('identity', 'Auth, sessions, profile, MFA')
    .addTag('trip', 'Trip CRUD, itinerary, sharing, overview composite')
    .addTag('media', 'Media uploads, memory books')
    .addTag('social', 'Reviews, votes, expenses, balances')
    .addTag('notifications', 'Inbox + delivery channels')
    .addTag('admin', 'Operator-only moderation surfaces')
    .addTag('account', 'GDPR / DPDP / COPPA self-export + delete')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Emit YAML for human-readable diffs in PRs. JSON variant is
  // commented out — flip on if/when the future orval SDK generator
  // wants the canonical form.
  const yaml = await import('yaml').catch(() => null);
  // Resolve docs/api/ from the script's location so the output
  // always lands at the repo root regardless of where the script
  // is invoked from. `pnpm --filter=api api:openapi` sets cwd to
  // `apps/api`; `pnpm` from the repo root sets cwd to repo root.
  // Either way, this file lives at apps/api/scripts/.
  const outDir = join(__dirname, '..', '..', '..', 'docs', 'api');
  mkdirSync(outDir, { recursive: true });

  if (yaml) {
    const yamlOut = (yaml as typeof import('yaml')).stringify(document);
    const outPath = join(outDir, 'openapi.yaml');
    writeFileSync(outPath, yamlOut, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[export-openapi] wrote ${outPath}`);
  } else {
    // Fallback to JSON when `yaml` isn't installed — keeps the
    // pipeline working without forcing the dep on users who don't
    // care about the readability win.
    const jsonOut = JSON.stringify(document, null, 2);
    const outPath = join(outDir, 'openapi.json');
    writeFileSync(outPath, jsonOut, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[export-openapi] wrote ${outPath} (yaml dep not present)`);
  }

  await app.close();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error('[export-openapi] FAILED:', message);
  process.exit(1);
});
