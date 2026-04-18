/**
 * Central PII / secret redaction list.
 *
 * Anything matched by these Pino paths is replaced with `[REDACTED]`
 * before the log line is serialised. Add new patterns here — NEVER
 * suppress a field by omitting it from a log call, because you can't
 * enforce that across the codebase.
 *
 * Path syntax (Pino): dot-paths against the log object. `*.x` matches
 * `x` at any first-level key; use `*.*.x` for deeper patterns.
 *
 * Playbook §15.2.
 */
export const PII_REDACT_PATHS: readonly string[] = Object.freeze([
  // HTTP-request bleed
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',

  // Direct top-level fields
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'secret',
  'mfaSecret',
  'backupCode',
  'backupCodes',
  'ssn',
  'creditCard',
  'cvv',
  'email',
  'emailHash',
  'phone',
  'passport',

  // One-level-deep under any key (e.g. body.password, user.email)
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.apiKey',
  '*.secret',
  '*.mfaSecret',
  '*.backupCode',
  '*.backupCodes',
  '*.ssn',
  '*.creditCard',
  '*.cvv',
  '*.email',
  '*.emailHash',
  '*.phone',
  '*.passport',
]);
