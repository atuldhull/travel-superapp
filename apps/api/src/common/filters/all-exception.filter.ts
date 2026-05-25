/**
 * Catch-all fallback for anything not handled by `DomainExceptionFilter`.
 *
 * Two branches:
 *   1. `HttpException` (Nest's own — `BadRequestException`, `NotFoundException`
 *      from unmatched routes, `ForbiddenException` from guards, etc.) —
 *      preserve the original status + body, enrich with `traceId` and
 *      `timestamp`, do NOT re-throw.
 *   2. Anything else — genuine bug. Log at ERROR with full stack, respond
 *      with a generic 500 `INTERNAL_ERROR`. The stack trace never leaves
 *      the server (info-leak rule from Playbook §15.1).
 *
 * In non-production environments the raw message is echoed to speed up
 * local debugging; prod returns a constant "Internal server error".
 *
 * Installed by prompt [III.11.5]. See Playbook §11.5 + §15.1.
 */
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { type Clock, SYSTEM_CLOCK } from '@app/clock';
import { type AppLogger, createLogger, getTraceContext } from '@app/logger';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger: AppLogger = createLogger('AllExceptionFilter');

  // [M6] Optional `clock` constructor parameter so 131 existing
  // `new AllExceptionFilter()` call sites (main.ts + every e2e
  // spec) keep compiling. Tests that want deterministic timestamps
  // pass a FakeClock; production gets the SYSTEM_CLOCK default.
  constructor(private readonly clock: Clock = SYSTEM_CLOCK) {}

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<FastifyReply>();
    const traceId = getTraceContext()?.traceId;
    const timestamp = this.clock.now().toISOString();

    // 1. NestJS built-in exceptions — keep their contract.
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      const payload: Record<string, unknown> =
        typeof body === 'object' && body !== null
          ? (body as Record<string, unknown>)
          : { message: String(body) };

      void response.status(status).send({
        ...payload,
        traceId,
        timestamp,
      });
      return;
    }

    // 2. Truly unhandled — bug. Log everything, reply with a sanitised 500.
    const errInfo =
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { message: String(err) };

    this.logger.error({ err: errInfo, traceId }, 'unhandled_exception');

    const isProduction = (process.env['NODE_ENV'] ?? 'development') === 'production';

    void response.status(500).send({
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Internal server error'
        : (errInfo.message ?? 'Internal server error'),
      traceId,
      timestamp,
    });
  }
}
