import {
  AgentNotVerifiedError,
  ConflictError,
  DomainError,
  ExternalServiceError,
  ForbiddenError,
  InvalidRadiusError,
  InvariantError,
  NotFoundError,
  PaymentFailedError,
  PlaceNotFoundError,
  RateLimitError,
  SafetyCheckFailedError,
  TripNotFoundError,
  UnauthorizedError,
  UserNotFoundError,
  ValidationError,
} from '../src';

describe('Generic HTTP errors', () => {
  it.each([
    [UnauthorizedError, 401, 'UNAUTHORIZED'],
    [PaymentFailedError, 402, 'PAYMENT_FAILED'],
    [ForbiddenError, 403, 'FORBIDDEN'],
    [NotFoundError, 404, 'NOT_FOUND'],
    [ConflictError, 409, 'CONFLICT'],
    [SafetyCheckFailedError, 451, 'SAFETY_CHECK_FAILED'],
    [InvariantError, 500, 'INVARIANT_VIOLATION'],
  ] as const)('%p has default code %s and status %i', (Ctor, status, code) => {
    const err = new (Ctor as new (message: string) => DomainError)('x');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
    expect(err.toJSON().code).toBe(code);
  });

  it('accepts a custom code override', () => {
    const err = new NotFoundError('gone', { kind: 'trip' }, 'TRIP_GONE');
    expect(err.code).toBe('TRIP_GONE');
    expect(err.context).toEqual({ kind: 'trip' });
  });
});

describe('ValidationError', () => {
  it('freezes nested fieldErrors arrays', () => {
    const err = new ValidationError('bad input', { name: ['required'] });
    expect(err.fieldErrors).toEqual({ name: ['required'] });
    expect(Object.isFrozen(err.fieldErrors)).toBe(true);
    expect(Object.isFrozen(err.fieldErrors['name'])).toBe(true);
  });

  it('emits fieldErrors via toJSON', () => {
    const err = new ValidationError('bad', { email: ['invalid'], age: ['min 18'] });
    const json = err.toJSON();
    expect(json.code).toBe('VALIDATION_FAILED');
    expect(json.fieldErrors).toEqual({ email: ['invalid'], age: ['min 18'] });
  });

  it('maps to HTTP 422', () => {
    const err = new ValidationError('x');
    expect(err.httpStatus).toBe(422);
  });
});

describe('RateLimitError', () => {
  it('exposes retryAfterMs', () => {
    const err = new RateLimitError('slow down', 2_500);
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfterMs).toBe(2500);
    expect(err.toJSON().retryAfterMs).toBe(2500);
  });

  it('clamps negative retry values to 0', () => {
    const err = new RateLimitError('x', -1);
    expect(err.retryAfterMs).toBe(0);
  });

  it('floors fractional retry values', () => {
    const err = new RateLimitError('x', 1234.9);
    expect(err.retryAfterMs).toBe(1234);
  });
});

describe('ExternalServiceError', () => {
  it('records the upstream service name and surfaces it in toJSON', () => {
    const err = new ExternalServiceError('stripe', 'timeout after 30s');
    expect(err.httpStatus).toBe(502);
    expect(err.service).toBe('stripe');
    expect(err.context['service']).toBe('stripe');
    expect(err.toJSON()).toMatchObject({ service: 'stripe', code: 'EXTERNAL_SERVICE_FAILED' });
  });
});

describe('Domain-specific errors', () => {
  it('TripNotFoundError extends NotFoundError with its own code + id in context', () => {
    const err = new TripNotFoundError('trip_123');
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('TRIP_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.context).toEqual({ tripId: 'trip_123' });
    expect(err.message).toContain('trip_123');
  });

  it('PlaceNotFoundError and UserNotFoundError follow the same pattern', () => {
    const place = new PlaceNotFoundError('place_1');
    expect(place.code).toBe('PLACE_NOT_FOUND');
    expect(place.context).toEqual({ placeId: 'place_1' });

    const user = new UserNotFoundError('user_1');
    expect(user.code).toBe('USER_NOT_FOUND');
    expect(user.context).toEqual({ userId: 'user_1' });
  });

  it('AgentNotVerifiedError extends ForbiddenError', () => {
    const err = new AgentNotVerifiedError('agent_7');
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe('AGENT_NOT_VERIFIED');
    expect(err.httpStatus).toBe(403);
    expect(err.context).toEqual({ agentId: 'agent_7' });
  });

  it('InvalidRadiusError extends ValidationError with fieldErrors for radiusKm', () => {
    const err = new InvalidRadiusError(750, 500);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('INVALID_RADIUS');
    expect(err.httpStatus).toBe(422);
    expect(err.context).toEqual({ radiusKm: 750, maxKm: 500 });
    expect(err.fieldErrors).toEqual({ radiusKm: ['must be between 0 and 500'] });
    const json = err.toJSON();
    expect(json.fieldErrors).toEqual({ radiusKm: ['must be between 0 and 500'] });
  });
});

describe('Serialization safety', () => {
  it('JSON.stringify does not leak the stack trace', () => {
    const err = new TripNotFoundError('trip_1');
    const json = JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    expect(json['stack']).toBeUndefined();
    expect(json['code']).toBe('TRIP_NOT_FOUND');
    expect(json['context']).toEqual({ tripId: 'trip_1' });
    expect(typeof json['timestamp']).toBe('string');
  });
});
