/**
 * Maps every `DomainError` thrown from controllers, use cases, or services
 * to a safe HTTP response.
 *
 * Response body is whatever the error's `toJSON()` produces (see
 * `@app/errors`), plus:
 *   - `traceId` from the current `AsyncLocalStorage` trace context
 *     (populated by the logger middleware — `[III.11.6]`).
 *
 * Subclass-specific side-effects:
 *   - `RateLimitError.retryAfterMs` → `Retry-After` HTTP header (rounded up
 *     to whole seconds per RFC 9110).
 *
 * Logs at `warn` — domain errors are expected application behaviour
 * (missing trip, failed validation, rate limit). Bugs (unhandled errors)
 * log at `error` via `AllExceptionFilter`.
 *
 * Installed by prompt [III.11.5]. See Playbook §11.5.
 */
import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DomainError, RateLimitError } from '@app/errors';
import { type AppLogger, createLogger, getTraceContext } from '@app/logger';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger: AppLogger = createLogger('DomainExceptionFilter');

  catch(err: DomainError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<FastifyReply>();
    const traceId = getTraceContext()?.traceId;

    if (err instanceof RateLimitError) {
      // RFC 9110 §10.2.3 — Retry-After as a non-negative integer of seconds.
      response.header('Retry-After', Math.max(1, Math.ceil(err.retryAfterMs / 1000)).toString());
    }

    this.logger.warn(
      {
        err: err.toJSON(),
        httpStatus: err.httpStatus,
        traceId,
      },
      'domain_error',
    );

    void response.status(err.httpStatus).send({
      ...err.toJSON(),
      traceId,
    });
  }
}
