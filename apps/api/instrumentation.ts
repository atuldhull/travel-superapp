/**
 * OpenTelemetry SDK initialisation for apps/api.
 *
 * **MUST be the VERY FIRST import in apps/api/src/main.ts** — before any
 * other `import` / `require`. OpenTelemetry's auto-instrumentation patches
 * modules (http, @nestjs/core, @prisma/client, ioredis, undici, …) at
 * require-time; instrumenting them only works if the SDK starts BEFORE
 * those libraries are loaded.
 *
 *   // apps/api/src/main.ts
 *   import '../instrumentation';  // MUST be line 1
 *   import { NestFactory } from '@nestjs/core';
 *   // … rest of bootstrap
 *
 * Set `OTEL_DISABLED=true` in the env to skip SDK startup (useful for
 * local runs without Jaeger running, to avoid exporter retry spam).
 * Otherwise traces land at `OTEL_EXPORTER_OTLP_ENDPOINT` via OTLP/HTTP
 * (dev: Jaeger `http://localhost:4318`; prod: Grafana Tempo).
 *
 * Installed by prompt [IV.17.6]; real SDK wired by [III.15.4].
 */
import { initTracing } from '@app/observability';

initTracing('api', {
  serviceVersion: process.env['npm_package_version'] ?? '0.0.0',
});

export {};
