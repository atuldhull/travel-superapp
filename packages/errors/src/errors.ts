/**
 * Concrete `DomainError` subclasses.
 *
 * Naming convention:
 *   - Generic HTTP errors: `<Semantic>Error` (NotFoundError, ConflictError…).
 *     Default code = `<UPPER_SNAKE>`; callers may override via constructor
 *     if a domain-specific code isn't warranted.
 *   - Domain-specific errors extend the closest generic and pass their
 *     own code to `super(...)`. They also accept the relevant id/ref
 *     up front so call-sites read like English:
 *         throw new TripNotFoundError(tripId);
 *
 * Every class is thin on purpose — the interesting behaviour lives in
 * `DomainError.toJSON()` and the global exception filter ([III.11.5]).
 *
 * Playbook §15.1 / [III.15.1].
 */
import { DomainError, type DomainErrorContext, type DomainErrorJson } from './base.error';

// ─── 401 Unauthorized ───────────────────────────────────────────────────
export class UnauthorizedError extends DomainError {
  readonly code: string;
  readonly httpStatus = 401 as const;

  constructor(message = 'Unauthorized', context: DomainErrorContext = {}, code = 'UNAUTHORIZED') {
    super(message, context);
    this.code = code;
  }
}

// ─── 402 Payment Required ───────────────────────────────────────────────
export class PaymentFailedError extends DomainError {
  readonly code: string;
  readonly httpStatus = 402 as const;

  constructor(message: string, context: DomainErrorContext = {}, code = 'PAYMENT_FAILED') {
    super(message, context);
    this.code = code;
  }
}

// ─── 403 Forbidden ──────────────────────────────────────────────────────
export class ForbiddenError extends DomainError {
  readonly code: string;
  readonly httpStatus = 403 as const;

  constructor(message = 'Forbidden', context: DomainErrorContext = {}, code = 'FORBIDDEN') {
    super(message, context);
    this.code = code;
  }
}

/** Agent marketplace access attempted before KYC completes. */
export class AgentNotVerifiedError extends ForbiddenError {
  constructor(agentId: string) {
    super(`Agent ${agentId} has not completed KYC verification`, { agentId }, 'AGENT_NOT_VERIFIED');
  }
}

// ─── 404 Not Found ──────────────────────────────────────────────────────
export class NotFoundError extends DomainError {
  readonly code: string;
  readonly httpStatus = 404 as const;

  constructor(message = 'Not found', context: DomainErrorContext = {}, code = 'NOT_FOUND') {
    super(message, context);
    this.code = code;
  }
}

export class TripNotFoundError extends NotFoundError {
  constructor(tripId: string) {
    super(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
  }
}

export class PlaceNotFoundError extends NotFoundError {
  constructor(placeId: string) {
    super(`Place not found: ${placeId}`, { placeId }, 'PLACE_NOT_FOUND');
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, { userId }, 'USER_NOT_FOUND');
  }
}

// ─── 409 Conflict ───────────────────────────────────────────────────────
export class ConflictError extends DomainError {
  readonly code: string;
  readonly httpStatus = 409 as const;

  constructor(message: string, context: DomainErrorContext = {}, code = 'CONFLICT') {
    super(message, context);
    this.code = code;
  }
}

// ─── 422 Unprocessable Entity ───────────────────────────────────────────
/** Map of field path → list of human-readable reasons. Safe for clients. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class ValidationError extends DomainError {
  readonly code: string;
  readonly httpStatus = 422 as const;
  readonly fieldErrors: FieldErrors;

  constructor(
    message = 'Validation failed',
    fieldErrors: Readonly<Record<string, readonly string[] | string[]>> = {},
    context: DomainErrorContext = {},
    code = 'VALIDATION_FAILED',
  ) {
    super(message, context);
    this.code = code;
    // Deep-freeze the per-field arrays so callers can't mutate after construction.
    const frozen: Record<string, readonly string[]> = {};
    for (const [key, value] of Object.entries(fieldErrors)) {
      frozen[key] = Object.freeze([...value]);
    }
    this.fieldErrors = Object.freeze(frozen);
  }

  override toJSON(): DomainErrorJson & { readonly fieldErrors: FieldErrors } {
    return { ...super.toJSON(), fieldErrors: this.fieldErrors };
  }
}

/** Radius in km exceeded the hard domain cap (Playbook §11.2). */
export class InvalidRadiusError extends ValidationError {
  constructor(radiusKm: number, maxKm = 500) {
    super(
      `Radius ${radiusKm}km exceeds the maximum of ${maxKm}km`,
      { radiusKm: [`must be between 0 and ${maxKm}`] },
      { radiusKm, maxKm },
      'INVALID_RADIUS',
    );
  }
}

// ─── 429 Too Many Requests ──────────────────────────────────────────────
export class RateLimitError extends DomainError {
  readonly code: string;
  readonly httpStatus = 429 as const;
  /** Milliseconds the caller should wait before retrying. */
  readonly retryAfterMs: number;

  constructor(
    message = 'Rate limit exceeded',
    retryAfterMs: number,
    context: DomainErrorContext = {},
    code = 'RATE_LIMITED',
  ) {
    super(message, context);
    this.code = code;
    this.retryAfterMs = Math.max(0, Math.floor(retryAfterMs));
  }

  override toJSON(): DomainErrorJson & { readonly retryAfterMs: number } {
    return { ...super.toJSON(), retryAfterMs: this.retryAfterMs };
  }
}

// ─── 451 Unavailable For Legal Reasons ──────────────────────────────────
export class SafetyCheckFailedError extends DomainError {
  readonly code: string;
  readonly httpStatus = 451 as const;

  constructor(message: string, context: DomainErrorContext = {}, code = 'SAFETY_CHECK_FAILED') {
    super(message, context);
    this.code = code;
  }
}

// ─── 500 Internal (invariant / should-never-happen) ─────────────────────
export class InvariantError extends DomainError {
  readonly code: string;
  readonly httpStatus = 500 as const;

  constructor(message: string, context: DomainErrorContext = {}, code = 'INVARIANT_VIOLATION') {
    super(message, context);
    this.code = code;
  }
}

// ─── 502 Bad Gateway (upstream/external-service wrap) ───────────────────
export class ExternalServiceError extends DomainError {
  readonly code: string;
  readonly httpStatus = 502 as const;
  /** Name of the external service (e.g. "stripe", "google-places"). */
  readonly service: string;

  constructor(
    service: string,
    message: string,
    context: DomainErrorContext = {},
    code = 'EXTERNAL_SERVICE_FAILED',
  ) {
    super(message, { ...context, service });
    this.code = code;
    this.service = service;
  }

  override toJSON(): DomainErrorJson & { readonly service: string } {
    return { ...super.toJSON(), service: this.service };
  }
}
