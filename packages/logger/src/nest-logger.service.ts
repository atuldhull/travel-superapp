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
import { Injectable, Optional, type LoggerService as NestLoggerService } from '@nestjs/common';
import type { AppLogger } from './logger';
import { createLogger } from './logger';

@Injectable()
export class AppNestLoggerService implements NestLoggerService {
  private readonly logger: AppLogger;

  /**
   * `@Optional()` tells Nest DI "don't fail if no provider resolves this
   * parameter". `AppLogger` is Pino's `Logger` interface (no runtime
   * class), so reflect-metadata gives Nest `Object` as the type token;
   * without `@Optional()` Nest would refuse to construct the service
   * because it can't find a provider for `Object`. With `@Optional()`
   * Nest passes `undefined` and the fallback `createLogger('NestJS')`
   * takes over. Direct test usage `new AppNestLoggerService(myLogger)`
   * is unaffected.
   */
  constructor(@Optional() logger?: AppLogger) {
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
