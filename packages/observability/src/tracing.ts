import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

/**
 * Build a NodeSDK configured with:
 *   - OTLP/HTTP trace exporter pointing at Jaeger (dev) or Tempo (prod).
 *   - Auto-instrumentations for http, fastify, nest, prisma, ioredis,
 *     undici — all named explicitly by the spec in [III.15.4].
 *   - Resource attributes: service.name, service.version,
 *     deployment.environment.
 *
 * Does NOT start the SDK — call `sdk.start()` from `init.ts`. Kept
 * separate so a caller can assemble-then-inspect the config in tests.
 *
 * Installed by prompt [III.15.4].
 */
export interface CreateSdkOptions {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly environment?: string;
  /**
   * Full OTLP HTTP endpoint base (e.g. `http://localhost:4318`).
   * `/v1/traces` is appended by the exporter. Defaults to the
   * `OTEL_EXPORTER_OTLP_ENDPOINT` env var, then `http://localhost:4318`.
   */
  readonly otlpEndpoint?: string;
  /** Surface OTel's internal diagnostics at this level. Default: WARN. */
  readonly diagLogLevel?: DiagLogLevel;
}

export function createSdk(opts: CreateSdkOptions): NodeSDK {
  diag.setLogger(new DiagConsoleLogger(), opts.diagLogLevel ?? DiagLogLevel.WARN);

  const endpoint = (
    opts.otlpEndpoint ??
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
    'http://localhost:4318'
  ).replace(/\/$/, '');
  const environment = opts.environment ?? process.env['NODE_ENV'] ?? 'development';

  return new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: opts.serviceName,
      [ATTR_SERVICE_VERSION]: opts.serviceVersion ?? '0.0.0',
      // Semantic-conventions 1.28 hasn't promoted deployment.environment.name
      // out of incubating yet. Use the canonical string literal.
      'deployment.environment': environment,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs is extremely noisy and adds tracer overhead to every file
        // read (node_modules resolution, config loads). Disable by default.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // dns is similarly low-signal.
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
      // Prisma spans require BOTH this instrumentation AND
      // `previewFeatures = ["tracing"]` in `prisma/schema.prisma`.
      // The schema preview flag only takes effect after `prisma
      // generate` — on Windows + OneDrive, regenerate while no app
      // holds the query engine DLL (stop `pnpm dev` first).
      new PrismaInstrumentation(),
    ],
  });
}
