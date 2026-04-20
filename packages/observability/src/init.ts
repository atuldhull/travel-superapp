import type { NodeSDK } from '@opentelemetry/sdk-node';
import { createSdk, type CreateSdkOptions } from './tracing';

/**
 * One-call OTel bootstrap. MUST run before the app imports http,
 * @nestjs/core, @prisma/client, ioredis, etc. — auto-instrumentations
 * patch those modules at require-time.
 *
 *   // apps/api/instrumentation.ts — VERY FIRST import in main.ts
 *   import { initTracing } from '@app/observability';
 *   initTracing('api');
 *
 * Second calls within the same process are no-ops (safe for hot-reload
 * in dev tooling that re-imports the bootstrap).
 *
 * Respects `OTEL_DISABLED=true` — skip SDK startup entirely. Useful
 * for CI runs against a dev DB where you don't need traces cluttering
 * the exporter, and for local runs without Jaeger to avoid retry spam.
 *
 * Installed by prompt [III.15.4].
 */

let sdk: NodeSDK | null = null;

export function initTracing(
  serviceName: string,
  opts: Omit<CreateSdkOptions, 'serviceName'> = {},
): NodeSDK | null {
  if (sdk) return sdk;
  if (process.env['OTEL_DISABLED'] === 'true') {
    // eslint-disable-next-line no-console
    console.warn('[observability] OTEL_DISABLED=true — tracing skipped.');
    return null;
  }
  sdk = createSdk({ serviceName, ...opts });
  sdk.start();

  // Flush + shutdown on SIGTERM so in-flight spans aren't lost on
  // graceful pod termination. `once` so we don't stack listeners if
  // the module is re-imported.
  process.once('SIGTERM', () => {
    void shutdown();
  });
  return sdk;
}

/** Flush pending spans + stop the SDK. Idempotent. */
export async function shutdown(): Promise<void> {
  if (!sdk) return;
  const current = sdk;
  sdk = null;
  try {
    await current.shutdown();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[observability] OTel shutdown failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

/** Test-only: reset the singleton. Do NOT call from production code. */
export function __resetForTests(): void {
  sdk = null;
}
