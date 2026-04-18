/**
 * apps/api bootstrap.
 *
 * Load order matters:
 *   1. `../instrumentation` — MUST be first import so OpenTelemetry can
 *      monkey-patch http/Nest/Prisma/Redis before they're loaded
 *      ([IV.17.6] stub; real SDK wiring in [III.15.4]).
 *   2. `reflect-metadata` — required by Nest's decorator metadata.
 *   3. Everything else.
 *
 * Bootstrap steps:
 *   1. Validate env (fail-fast if any required var is missing/invalid).
 *   2. Create Nest app with Fastify adapter + bufferLogs so early Nest
 *      lines get replayed once the real logger is wired.
 *   3. Swap Nest's built-in logger for our Pino-backed one.
 *   4. Set global prefix `/api/v1` — except for health probes, which
 *      Kubernetes / Fly.io hit at `/health/*` directly.
 *   5. Listen on 0.0.0.0:$PORT.
 *
 * Installed by prompt [III.11.0]. See Playbook §10 + §15.2.
 */
import '../instrumentation';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { EnvValidationError, validateEnv } from '@app/config';
import { AppNestLoggerService, createLogger } from '@app/logger';
import { AppModule } from './app.module';

const bootLog = createLogger('bootstrap');

async function bootstrap(): Promise<void> {
  // 1. Fail fast on invalid env before any Nest/Fastify import chain runs.
  let env: ReturnType<typeof validateEnv>;
  try {
    env = validateEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      bootLog.fatal({ issues: err.issues }, 'env_validation_failed');
    } else {
      bootLog.fatal({ err: String(err) }, 'env_validation_failed');
    }
    process.exit(1);
  }

  // 2. Create the Nest app. `bufferLogs: true` holds early Nest log lines
  //    until `useLogger` below is in place — no lost output.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // 3. Replace Nest's built-in ConsoleLogger with our Pino bridge.
  app.useLogger(app.get(AppNestLoggerService));

  // 4. `/api/v1` prefix for business routes; `/health/*` stays bare for probes.
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/(.*)'],
  });

  // 5. Shutdown hooks so SIGTERM drains in-flight requests cleanly (Fly.io / k8s).
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');

  bootLog.info({ port: env.PORT, nodeEnv: env.NODE_ENV, logLevel: env.LOG_LEVEL }, 'api_started');
}

bootstrap().catch((err: unknown) => {
  bootLog.fatal({ err: err instanceof Error ? err.message : String(err) }, 'bootstrap_failed');
  process.exit(1);
});
