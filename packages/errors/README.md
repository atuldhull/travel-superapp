# @app/errors

Domain error hierarchy for TravelSuperApp. Zero runtime dependencies.
Installed by prompt `[III.15.1]`. See Playbook §15.1.

## Why

Every handler in the system — HTTP controllers, queue workers, scheduled
jobs — must fail in one predictable way: an instance of `DomainError`.
The global exception filter ([III.11.5]) takes it from there: maps the
class to an HTTP status, serializes a safe JSON body, and logs the error
with the current trace id.

This package is the source of truth for that contract.

## Usage

```ts
import {
  TripNotFoundError,
  ValidationError,
  RateLimitError,
  isDomainError,
} from '@app/errors';

// In a use case
async execute(cmd: { tripId: string }) {
  const trip = await this.repo.findById(cmd.tripId);
  if (!trip) throw new TripNotFoundError(cmd.tripId);
  return trip;
}

// In a trust boundary (catch unknown, re-throw DomainError)
try {
  await externalCall();
} catch (err) {
  if (isDomainError(err)) throw err;
  throw new ExternalServiceError('stripe', (err as Error).message);
}
```

## Class map

| HTTP | Class                    | `code`                    | Extra fields           |
| ---- | ------------------------ | ------------------------- | ---------------------- |
| 401  | `UnauthorizedError`      | `UNAUTHORIZED` (default)  | —                      |
| 402  | `PaymentFailedError`     | `PAYMENT_FAILED`          | —                      |
| 403  | `ForbiddenError`         | `FORBIDDEN`               | —                      |
| 403  | `AgentNotVerifiedError`  | `AGENT_NOT_VERIFIED`      | `agentId` in context   |
| 404  | `NotFoundError`          | `NOT_FOUND`               | —                      |
| 404  | `TripNotFoundError`      | `TRIP_NOT_FOUND`          | `tripId` in context    |
| 404  | `PlaceNotFoundError`     | `PLACE_NOT_FOUND`         | `placeId` in context   |
| 404  | `UserNotFoundError`      | `USER_NOT_FOUND`          | `userId` in context    |
| 409  | `ConflictError`          | `CONFLICT`                | —                      |
| 422  | `ValidationError`        | `VALIDATION_FAILED`       | `fieldErrors` map      |
| 422  | `InvalidRadiusError`     | `INVALID_RADIUS`          | `fieldErrors.radiusKm` |
| 429  | `RateLimitError`         | `RATE_LIMITED`            | `retryAfterMs`         |
| 451  | `SafetyCheckFailedError` | `SAFETY_CHECK_FAILED`     | —                      |
| 500  | `InvariantError`         | `INVARIANT_VIOLATION`     | —                      |
| 502  | `ExternalServiceError`   | `EXTERNAL_SERVICE_FAILED` | `service` name         |

## JSON shape on the wire

```json
{
  "code": "TRIP_NOT_FOUND",
  "message": "Trip not found: trip_123",
  "context": { "tripId": "trip_123" },
  "timestamp": "2026-04-18T08:42:13.219Z"
}
```

`ValidationError`, `RateLimitError`, and `ExternalServiceError` add
`fieldErrors`, `retryAfterMs`, or `service` respectively via their own
`toJSON()` overrides.

**Never** is the stack trace included. It stays on the Error for log
sinks; clients get structured data only.

## Rules

1. **Only throw `DomainError`s across layer boundaries.** Catch native
   errors (`TypeError`, Prisma errors, fetch failures) at trust
   boundaries and re-throw as the closest domain error.
2. **Never put secrets/PII in `context`.** Ids and enums only. The
   context is serialized to clients verbatim.
3. **`code` values are public API.** Changing a code is a breaking
   change for mobile clients that key UX off of them.
4. **Introduce a new error class when callers must branch on it.**
   Otherwise extend an existing one with a custom `code` via the
   constructor parameter.

## Scripts

| Command                                | What                               |
| -------------------------------------- | ---------------------------------- |
| `pnpm --filter=@app/errors build`      | Emit CJS + d.ts to `dist/`         |
| `pnpm --filter=@app/errors typecheck`  | `tsc --noEmit`                     |
| `pnpm --filter=@app/errors lint`       | ESLint via `@app/eslint-config`    |
| `pnpm --filter=@app/errors test`       | Jest (ts-jest, CommonJS transform) |
| `pnpm --filter=@app/errors test:watch` | Jest watch mode                    |

## See also

- Playbook §15.1 — this package's spec.
- Prompt `[III.11.5]` — the global exception filter in `apps/api` that
  maps `DomainError` → HTTP response.
- Prompt `[III.13.1]` — the Zod validation pipe that throws
  `ValidationError` with populated `fieldErrors`.
- Prompt `[III.11.4]` — the rate limiter that throws `RateLimitError`.
