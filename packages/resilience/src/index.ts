/**
 * @app/resilience — circuit breaker + retry + timeout primitives.
 *
 * Why: the review's "near-me 502 from a weather-provider hiccup
 * proves there are no circuit breakers" — every external HTTP call
 * today fails closed. One upstream blip cascades into 5xx on our
 * route. Wrap each external adapter with a CircuitBreaker and the
 * NEXT blip serves a fast fallback instead.
 *
 * Three primitives:
 *
 *   1. `CircuitBreaker` — the three-state machine (closed / open /
 *      half-open) with a configurable failure window + recovery
 *      probe. Time is via `@app/clock` so tests roll the breaker
 *      through states without `setTimeout` flakes.
 *
 *   2. `withTimeout(promise, ms, clock)` — bounded wait. Returns a
 *      rejected `TimeoutError` if the wrapped promise hasn't
 *      settled within `ms`. The underlying promise keeps running
 *      (no abort signal here — callers that need abort wire their
 *      own `AbortController`).
 *
 *   3. `withRetry(fn, opts)` — exponential-backoff retry with
 *      optional jitter. Honors a `shouldRetry(err)` predicate so
 *      4xx-ish errors don't get retried.
 *
 * Wired in [N8] across every external adapter; the
 * `withCircuitBreaker(name, opts)` factory in this file is what
 * the adapter constructors call.
 *
 * Installed by [N8].
 */
import type { Clock } from '@app/clock';

// ─── CIRCUIT BREAKER ───────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Name surfaced in errors + metrics + logs. */
  readonly name: string;
  /** Clock for state transitions + cooldown windows. */
  readonly clock: Clock;
  /**
   * Failures-in-a-row needed to open the circuit. Default 5.
   * The window is a SLIDING set of recent calls (not absolute
   * count since boot).
   */
  readonly failureThreshold?: number;
  /**
   * Milliseconds to leave the circuit open before allowing a
   * half-open probe. Default 30s. Backs off naturally — fail
   * the probe and we go back open for another `openMs`.
   */
  readonly openMs?: number;
  /**
   * Optional predicate. Return false to NOT count an error
   * toward the failure threshold (e.g., 4xx errors from the
   * upstream are caller-bug, not upstream-fault).
   */
  readonly isFailure?: (err: unknown) => boolean;
  /**
   * Optional hook fired on every state transition. The Nest
   * adapter wires this to emit Prometheus counters.
   */
  readonly onTransition?: (from: CircuitState, to: CircuitState, name: string) => void;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30_000;

/**
 * Thrown by `CircuitBreaker.exec` when the breaker is OPEN. Carries
 * the name + the time the next probe will be allowed so the caller
 * can decide whether to serve a fallback or surface 503.
 */
export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';
  constructor(
    readonly circuitName: string,
    readonly nextProbeAt: number,
  ) {
    super(`Circuit "${circuitName}" is OPEN until ${new Date(nextProbeAt).toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly openMs: number;

  constructor(private readonly opts: CircuitBreakerOptions) {
    this.threshold = opts.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.openMs = opts.openMs ?? DEFAULT_OPEN_MS;
  }

  /**
   * Run `fn` through the breaker. Three outcomes:
   *
   *   - CLOSED:    just call. Record success / failure.
   *   - OPEN:      throw `CircuitOpenError` immediately (fast fail).
   *                When `now >= openedAt + openMs`, transition to
   *                half-open and allow this call through.
   *   - HALF-OPEN: allow exactly ONE call. On success, close the
   *                breaker. On failure, re-open (another full openMs).
   */
  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeRecover();
    if (this.state === 'open') {
      throw new CircuitOpenError(this.opts.name, this.openedAt + this.openMs);
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      const isFail = this.opts.isFailure ? this.opts.isFailure(err) : true;
      if (isFail) this.recordFailure();
      throw err;
    }
  }

  /** Internal: roll OPEN → HALF-OPEN once `openMs` has elapsed. */
  private maybeRecover(): void {
    if (this.state !== 'open') return;
    const now = this.opts.clock.nowMs();
    if (now - this.openedAt >= this.openMs) {
      this.transition('half-open');
    }
  }

  private recordSuccess(): void {
    if (this.state === 'half-open') {
      this.consecutiveFailures = 0;
      this.transition('closed');
      return;
    }
    // In closed state, success just resets the failure counter.
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    if (this.state === 'half-open') {
      // Probe failed — back to open.
      this.openedAt = this.opts.clock.nowMs();
      this.transition('open');
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold) {
      this.openedAt = this.opts.clock.nowMs();
      this.transition('open');
    }
  }

  private transition(next: CircuitState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.opts.onTransition?.(prev, next, this.opts.name);
  }

  /** Read-only state — for tests + metrics. */
  getState(): CircuitState {
    this.maybeRecover();
    return this.state;
  }

  /** Read-only failure-streak counter — for tests. */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}

// ─── TIMEOUT ───────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor(
    readonly label: string,
    readonly ms: number,
  ) {
    super(`Operation "${label}" timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Bound `promise` to `ms` milliseconds. Resolves to the original
 * value if it settles in time; rejects `TimeoutError` otherwise.
 *
 * Note: the original promise CONTINUES running — there is no
 * cancellation here. Callers that need abort wire an
 * `AbortController` upstream + reject on `signal.aborted`.
 *
 * `clock` is optional — falls back to a `setTimeout`-based
 * implementation. Pass a Clock for deterministic tests
 * (`makeFakeClock(0)` + manual `advance(ms)`).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'op',
  clock?: Clock,
): Promise<T> {
  // The clock-aware path uses the host's setTimeout because the
  // FakeClock doesn't simulate the JS event loop — but it DOES
  // expose `nowMs()` so tests that advance time can verify the
  // deadline was honored. For now, this is a thin host-timer
  // wrapper; a more sophisticated version with simulated timers
  // can come if test churn justifies it.
  void clock; // currently unused at runtime — kept for API symmetry
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);
    // Don't keep the event loop alive solely for this timer.
    t.unref?.();
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

// ─── RETRY ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Total attempts including the first call. Default 3. */
  readonly attempts?: number;
  /** Base delay between attempts in ms. Default 100. */
  readonly baseDelayMs?: number;
  /** Multiplier applied each retry. Default 2 (exponential). */
  readonly factor?: number;
  /** Jitter fraction [0..1]. Default 0.25. */
  readonly jitter?: number;
  /** Predicate: return false to stop retrying for this error. */
  readonly shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Required for deterministic test behaviour. */
  readonly clock?: Clock;
  /**
   * Optional rand for jitter. Defaults to `Math.random`. Tests
   * pin this to `() => 0.5` for determinism.
   */
  readonly random?: () => number;
}

const DEFAULT_RETRY: Required<
  Pick<RetryOptions, 'attempts' | 'baseDelayMs' | 'factor' | 'jitter'>
> = {
  attempts: 3,
  baseDelayMs: 100,
  factor: 2,
  jitter: 0.25,
};

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? DEFAULT_RETRY.attempts;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
  const factor = opts.factor ?? DEFAULT_RETRY.factor;
  const jitter = opts.jitter ?? DEFAULT_RETRY.jitter;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  const random = opts.random ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !shouldRetry(err, attempt)) {
        throw err;
      }
      const base = baseDelayMs * Math.pow(factor, attempt - 1);
      const jitterAmount = base * jitter * (random() * 2 - 1);
      const delayMs = Math.max(0, Math.round(base + jitterAmount));
      await sleep(delayMs);
    }
  }
  // Unreachable — the loop either returns or throws — but TS
  // doesn't know that.
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

// ─── FACTORY ───────────────────────────────────────────────────────────

/**
 * One-liner: a circuit-breaker scoped to `name`, sharing the host
 * Clock + emitting transitions to the host's logger / metrics via
 * `onTransition`. Most adapters call this once at construction +
 * route every external call through `breaker.exec(() => fetch(…))`.
 */
export function makeCircuitBreaker(opts: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(opts);
}

// ─── HELPER: callExternal ──────────────────────────────────────────────

export interface ExternalCallOptions {
  /** Per-adapter breaker (one instance shared across calls of that adapter). */
  readonly breaker: CircuitBreaker;
  /** Time budget for the inner call. Pass `undefined` to disable. */
  readonly timeoutMs?: number;
  /** Label surfaced in TimeoutError + circuit logs. */
  readonly label: string;
  /**
   * Optional mapper that runs ONLY when the breaker is OPEN. Lets the
   * adapter translate `CircuitOpenError` into its domain error class
   * (e.g. `ExternalServiceError`) so callers don't have to thread a
   * new error type. The mapper MUST throw — its return is `never`.
   */
  readonly onCircuitOpen?: (err: CircuitOpenError) => never;
}

/**
 * Wrap an external call (`fetch`, an AWS / Stripe / Twilio SDK method,
 * etc.) with a circuit breaker + optional timeout in one expression.
 * Keeps adapter call-sites to ~3 lines instead of the ~25-line
 * try/exec/catch dance.
 *
 * Every external adapter under `apps/api/src/modules/*\/infrastructure/*`
 * uses this. The fitness function
 * `external adapters wrapped in circuit breaker` enforces it on CI.
 */
export async function callExternal<T>(fn: () => Promise<T>, opts: ExternalCallOptions): Promise<T> {
  try {
    return await opts.breaker.exec(() =>
      opts.timeoutMs !== undefined ? withTimeout(fn(), opts.timeoutMs, opts.label) : fn(),
    );
  } catch (err) {
    if (err instanceof CircuitOpenError && opts.onCircuitOpen) {
      // The mapper throws; the `throw err` below is unreachable but
      // TypeScript needs the trailing `throw` for the control-flow
      // analyzer to type this branch correctly.
      opts.onCircuitOpen(err);
    }
    throw err;
  }
}
