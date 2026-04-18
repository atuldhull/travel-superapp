/**
 * NestJS `LoggerService` implementation that forwards every Nest-side
 * log call into our Pino-backed `AppLogger`. Register once in
 * `apps/api/main.ts` via `app.useLogger(app.get(NestLoggerService))`.
 *
 * Mapping:
 *   Nest.log     → pino.info
 *   Nest.error   → pino.error (message + optional stack)
 *   Nest.warn    → pino.warn
 *   Nest.debug   → pino.debug
 *   Nest.verbose → pino.trace   (Nest "verbose" ≈ Pino "trace")
 *   Nest.fatal   → pino.fatal   (Nest 10+)
 *
 * Playbook §15.2 · installed by prompt [III.11.6].
 */
import { Injectable, type LoggerService as NestLoggerService } from '@nestjs/common';
import type { AppLogger } from './logger';
import { createLogger } from './logger';

@Injectable()
export class AppNestLoggerService implements NestLoggerService {
  private readonly logger: AppLogger;

  constructor(logger?: AppLogger) {
    this.logger = logger ?? createLogger('NestJS');
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, stringify(message));
  }

  error(message: unknown, stack?: unknown, context?: string): void {
    this.logger.error({ context, stack }, stringify(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, stringify(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, stringify(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, stringify(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, stringify(message));
  }
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
