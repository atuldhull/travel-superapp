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

/**
 * Returns true when a REAL OTLP destination is configured — either a
 * managed-SaaS key (Honeycomb) or an explicit local/remote OTLP
 * endpoint. Without one, the OTLP/HTTP exporter pointed at the
 * `localhost:4318` default 404s constantly in prod (and in any dev
 * env that doesn't have Jaeger / Tempo running). [N1] gates SDK
 * startup on this so a misconfigured prod doesn't log-spam.
 */
function hasRealOtlpDestination(opts: Omit<CreateSdkOptions, 'serviceName'>): boolean {
  if (opts.honeycombApiKey || process.env['HONEYCOMB_API_KEY']) return true;
  if (opts.otlpEndpoint || process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return true;
  return false;
}

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
  // [N1] No real OTLP destination is configured — starting the SDK
  // would 404-spam against the default `localhost:4318`. Skip with
  // a one-line note so operators see why traces are absent.
  if (!hasRealOtlpDestination(opts)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[observability] Neither OTEL_EXPORTER_OTLP_ENDPOINT nor HONEYCOMB_API_KEY is set — ' +
        'tracing disabled (no exporter started). Set one of them, or set OTEL_DISABLED=true ' +
        'to suppress this warning. See ops/observability/README.md for the local stack.',
    );
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
