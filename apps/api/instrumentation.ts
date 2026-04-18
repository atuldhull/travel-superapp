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
 * Real SDK wiring — NodeSDK + `@opentelemetry/auto-instrumentations-node` +
 * OTLP exporter → Jaeger (dev) / Grafana Tempo (prod) — lands in **[III.15.4]**
 * and will live in `@app/observability`. Until then this file is a no-op
 * stub so the load-order contract is locked in at the call site.
 *
 * Installed by prompt [IV.17.6]. See Playbook §15.4.
 */

// Intentionally empty for now. Real OTel init code lands in [III.15.4].
// Do NOT remove this file — callers already follow the "import first" rule.
export {};
