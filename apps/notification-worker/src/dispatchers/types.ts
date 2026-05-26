/**
 * Shared types for the notification-worker dispatchers.
 *
 * The job payload type in `@app/jobs` constrains `vars` to
 * `Record<string, string | number | boolean | null>`; we widen to
 * `unknown` here so each dispatcher can narrow what it needs without
 * a chain of casts at the call site.
 */
export type NotificationVars = Record<string, unknown>;
