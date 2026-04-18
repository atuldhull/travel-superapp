/**
 * @app/errors — abstract `DomainError` base class.
 *
 * Every error thrown from the `domain/` or `application/` layer of any
 * NestJS module must extend `DomainError`. The global exception filter
 * ([III.11.5]) maps these to HTTP responses; workers map them to queue
 * retry policies. Outside code must only see `DomainError`s — never raw
 * Prisma errors, fetch errors, or Node `TypeError`s (catch-and-wrap).
 *
 * Design rules:
 *   - `code` is a stable, UPPER_SNAKE machine identifier. Clients gate
 *     UX on this, so changing it is a breaking API change.
 *   - `httpStatus` is the intended HTTP mapping. The filter trusts it.
 *   - `context` is a shallow JSON-safe bag with NO secrets / NO PII.
 *     If you need to attach a database row, include the id only.
 *   - `toJSON()` is what travels to the client: stack traces are OUT
 *     by design (info-leak risk). Stack stays on the Error for logs.
 *
 * Playbook §15.1 · installed by prompt [III.15.1].
 */

export type DomainErrorContext = Readonly<Record<string, unknown>>;

/** JSON shape emitted by `DomainError.toJSON()`. Clients depend on this. */
export interface DomainErrorJson {
  readonly code: string;
  readonly message: string;
  readonly context: DomainErrorContext;
  readonly timestamp: string;
}

/**
 * Base class for every error that the application layer throws at
 * the outside world. Concrete subclasses set `code` + `httpStatus`.
 */
export abstract class DomainError extends Error {
  /** Machine-readable identifier (UPPER_SNAKE). Treat as public API. */
  public abstract readonly code: string;

  /** Intended HTTP status. Used by the global exception filter. */
  public abstract readonly httpStatus: number;

  /** Structured, safe-to-serialize context. Never put secrets here. */
  public readonly context: DomainErrorContext;

  /** Creation timestamp (UTC). */
  public readonly timestamp: Date;

  protected constructor(message: string, context: DomainErrorContext = {}) {
    super(message);
    this.name = new.target.name;
    this.context = Object.freeze({ ...context });
    this.timestamp = new Date();

    // Preserve `instanceof` across transpilation targets (ES5, CJS, …).
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack from the subclass call-site, not DomainError itself.
    if (typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (
        Error as unknown as { captureStackTrace: (t: object, c: unknown) => void }
      ).captureStackTrace(this, new.target);
    }
  }

  /**
   * Safe-for-clients JSON representation. Subclasses override to add
   * fields (e.g. `fieldErrors`, `retryAfterMs`) by spreading the parent
   * result.
   */
  toJSON(): DomainErrorJson {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Type guard that narrows an unknown value to `DomainError`. Prefer
 * `instanceof DomainError` in code you own; use this at trust boundaries
 * (catch blocks that receive `unknown`).
 */
export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
