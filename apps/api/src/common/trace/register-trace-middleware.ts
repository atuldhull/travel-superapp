/**
 * Fastify `onRequest` hook that establishes a per-request trace
 * context. Every log line emitted while handling the request + every
 * `DomainError` rendered by the global filter picks up the same
 * `traceId` automatically via `@app/logger`'s AsyncLocalStorage.
 *
 * Semantics:
 *   - `x-trace-id` incoming header is honoured verbatim (lets an
 *     upstream LB / ingress inject a known id so a single request's
 *     logs are correlated across edge and api pods).
 *   - Otherwise we mint a fresh 128-bit hex id.
 *   - `x-request-id` is read into `requestId` if present — separate
 *     from trace so a single request can be correlated across retries
 *     (where the client reuses `x-trace-id` but emits a new
 *     `x-request-id` per attempt).
 *   - Echoed back on the response as `x-trace-id` so clients
 *     (including curl + browsers) can report it alongside errors.
 *
 * Installed by prompt [III.15.5].
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { enterTraceContext, generateTraceId, type TraceContext } from '@app/logger';

const TRACE_HEADER = 'x-trace-id';
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Shape of the incoming header — Fastify types it as `string |
 * string[] | undefined`. Arrays happen when the same header repeats.
 * We take the first.
 */
function readHeader(req: FastifyRequest, name: string): string | undefined {
  const raw = req.headers[name];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return undefined;
}

/** Loose validation on an incoming trace id — 16–64 hex chars. Anything
 *  else we consider spoofed/garbled and mint our own instead. */
function isWellFormedTraceId(value: string): boolean {
  return /^[0-9a-f]{16,64}$/i.test(value);
}

export async function registerTraceMiddleware(app: NestFastifyApplication): Promise<void> {
  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const incoming = readHeader(req, TRACE_HEADER);
    const traceId =
      incoming && isWellFormedTraceId(incoming) ? incoming.toLowerCase() : generateTraceId();
    const requestId = readHeader(req, REQUEST_ID_HEADER);

    const ctx: TraceContext = requestId ? { traceId, requestId } : { traceId };
    enterTraceContext(ctx);

    // Echo back so clients can quote the trace id when reporting
    // issues. Don't overwrite if a downstream hook already set it.
    if (!reply.getHeader(TRACE_HEADER)) {
      reply.header(TRACE_HEADER, traceId);
    }
  });
}
