/**
 * Async-local trace context for per-request correlation.
 *
 * Every HTTP request, BullMQ job, and background task enters its code
 * via `runWithTraceContext(...)`; every log line emitted from inside
 * automatically gets `traceId` + `userId` + `requestId` merged in (see
 * `src/logger.ts` `mixin`).
 *
 * We deliberately do **not** expose a raw accessor to the underlying
 * storage — callers may only `get` (read-only snapshot) or `run` (new
 * scope). This prevents accidentally leaking context across async
 * boundaries via direct mutation.
 *
 * Playbook §15.2 · installed by prompt [III.11.6].
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/** Fields every trace-scoped log line can expect to see. All optional on
 *  entry except `traceId` — the middleware is responsible for minting one. */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId?: string;
  readonly userId?: string;
  readonly requestId?: string;
  /** Freeform tags, merged into every log line in-scope. */
  readonly tags?: Readonly<Record<string, string | number | boolean>>;
}

const storage = new AsyncLocalStorage<TraceContext>();

/** Read the current context. Returns `undefined` outside any
 *  `runWithTraceContext` scope. */
export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

/** Run `fn` inside a fresh trace context. Nested calls create a new
 *  inner scope — the outer one is restored when `fn` returns (or
 *  throws). Works with sync and async functions alike. */
export function runWithTraceContext<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Enter a trace context without a wrapping callback — the context
 * persists for the current async chain until its root settles. Used
 * by HTTP middleware (Fastify `onRequest`, Express-style hooks) that
 * can't practically wrap the entire request with a `runWithTraceContext`
 * callback.
 *
 * Prefer `runWithTraceContext` whenever you control the call site;
 * `enterTraceContext` is the escape hatch for framework hooks.
 */
export function enterTraceContext(ctx: TraceContext): void {
  storage.enterWith(ctx);
}

/** Run `fn` with additional fields merged into the current context. If
 *  no outer context exists, a new one is minted with a generated
 *  `traceId`. Useful for "tag this subtree with the userId we just
 *  resolved" patterns inside middleware. */
export function extendTraceContext<T>(patch: Partial<TraceContext>, fn: () => T): T {
  const current = getTraceContext();
  const merged: TraceContext = {
    traceId: current?.traceId ?? generateTraceId(),
    ...current,
    ...patch,
    ...(current?.tags || patch.tags
      ? { tags: { ...(current?.tags ?? {}), ...(patch.tags ?? {}) } }
      : {}),
  };
  return storage.run(merged, fn);
}

/** Generate a 128-bit random trace id, rendered as 32 lowercase hex
 *  chars. Matches the W3C `trace-id` shape, so it drops cleanly into a
 *  `traceparent` header when we wire OpenTelemetry ([III.15.4]). */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/** Generate a 64-bit random span id (16 lowercase hex chars). W3C span-id shape. */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}
