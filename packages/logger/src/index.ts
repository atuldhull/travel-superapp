/**
 * @app/logger — Pino-backed structured logger with async trace context
 * and PII redaction.
 *
 * Installed by prompt [III.11.6]. See Playbook §15.2.
 */
export { createLogger } from './logger';
export type { AppLogger, CreateLoggerOptions, LogLevel } from './logger';

export {
  enterTraceContext,
  extendTraceContext,
  generateSpanId,
  generateTraceId,
  getTraceContext,
  runWithTraceContext,
} from './trace-context';
export type { TraceContext } from './trace-context';

export { PII_REDACT_PATHS } from './redact';

export { AppNestLoggerService } from './nest-logger.service';
