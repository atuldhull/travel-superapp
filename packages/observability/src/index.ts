/**
 * @app/observability — OpenTelemetry NodeSDK bootstrap.
 *
 * Entry points:
 *   • `initTracing(serviceName, opts?)` — wires traces to Jaeger (dev)
 *     or Grafana Tempo (prod) via OTLP/HTTP. Call once, before every
 *     other import. Respects `OTEL_DISABLED=true` env to skip.
 *   • `shutdown()` — flush + stop. Called automatically on SIGTERM.
 *   • `createSdk(opts)` — lower-level NodeSDK factory for bespoke
 *     setups (tests, alt exporters).
 *
 * Installed by prompt [III.15.4]. See Playbook §15.4.
 */
export { createSdk } from './tracing';
export type { CreateSdkOptions } from './tracing';
export { initTracing, shutdown } from './init';
