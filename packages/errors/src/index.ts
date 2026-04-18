/**
 * @app/errors — domain error hierarchy for TravelSuperApp.
 *
 * Installed by prompt [III.15.1]. See Playbook §15.1.
 */
export { DomainError, isDomainError } from './base.error';
export type { DomainErrorContext, DomainErrorJson } from './base.error';

export {
  UnauthorizedError,
  PaymentFailedError,
  ForbiddenError,
  AgentNotVerifiedError,
  NotFoundError,
  TripNotFoundError,
  PlaceNotFoundError,
  UserNotFoundError,
  ConflictError,
  ValidationError,
  InvalidRadiusError,
  RateLimitError,
  SafetyCheckFailedError,
  InvariantError,
  ExternalServiceError,
} from './errors';
export type { FieldErrors } from './errors';
