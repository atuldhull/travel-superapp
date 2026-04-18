/**
 * Pino-backed logger factory.
 *
 * Returns a `pino.Logger` configured with:
 *   - PII redaction (see `src/redact.ts`)
 *   - async trace-context mixin (see `src/trace-context.ts`)
 *   - ISO-8601 timestamps
 *   - `level: { level: label }` formatter so consumers see `"level":"info"`
 *     instead of `"level":30` (numeric Pino default).
 *
 * One-shot usage:
 *   const log = createLogger('places-module');
 *   log.info({ radiusKm: 5 }, 'search_places');
 *
 * `AppLogger` is a re-export of `pino.Logger` — we stay on the Pino
 * surface area deliberately. Ships CJS from `dist/`.
 *
 * Playbook §15.2 · installed by prompt [III.11.6].
 */
import pino, { type DestinationStream, type Logger, type LoggerOptions as PinoOptions } from 'pino';
import { PII_REDACT_PATHS } from './redact';
import { getTraceContext } from './trace-context';

/** Minimum log level to emit. Pino's native set, plus "silent". */
export type LogLevel = 'silent' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface CreateLoggerOptions {
  /** Minimum level. Defaults to `process.env.LOG_LEVEL` or `'info'`. */
  readonly level?: LogLevel;
  /** Extra redact paths merged onto `PII_REDACT_PATHS`. */
  readonly additionalRedactPaths?: readonly string[];
  /** Base fields attached to every log line (e.g. `{service: 'api'}`). */
  readonly base?: Readonly<Record<string, unknown>>;
  /** Optional destination stream — defaults to stdout. Useful in tests. */
  readonly destination?: DestinationStream;
  /** When true, enable `pino-pretty` for human-readable output (dev only). */
  readonly pretty?: boolean;
}

/** Our exported logger type. Same surface as `pino.Logger`; consumers
 *  call `.info(obj, msg)`, `.warn(…)`, `.child(bindings)`, etc. */
export type AppLogger = Logger;

/**
 * Create a new logger bound to a context string (usually the module or
 * package name — e.g. `"trip-module"`, `"ai-service"`).
 */
export function createLogger(context: string, options: CreateLoggerOptions = {}): AppLogger {
  const level: LogLevel =
    options.level ?? (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? 'info';

  const redactPaths = [...PII_REDACT_PATHS, ...(options.additionalRedactPaths ?? [])];

  const pinoOptions: PinoOptions = {
    name: context,
    level,
    base: { context, ...(options.base ?? {}) },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    mixin: mergeTraceContext,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.pretty && process.env['NODE_ENV'] !== 'production'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  };

  return options.destination ? pino(pinoOptions, options.destination) : pino(pinoOptions);
}

/** Mixin function — merges the current AsyncLocalStorage trace context
 *  into every log line. Empty object when outside any scope. */
function mergeTraceContext(): Record<string, unknown> {
  const ctx = getTraceContext();
  if (!ctx) return {};
  const { traceId, spanId, userId, requestId, tags } = ctx;
  const merged: Record<string, unknown> = { traceId };
  if (spanId !== undefined) merged['spanId'] = spanId;
  if (userId !== undefined) merged['userId'] = userId;
  if (requestId !== undefined) merged['requestId'] = requestId;
  if (tags !== undefined) merged['tags'] = tags;
  return merged;
}
