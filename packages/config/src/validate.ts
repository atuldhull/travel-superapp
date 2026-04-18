/**
 * Runtime env validation entry point.
 *
 * Call `validateEnv(process.env)` at the top of every app's bootstrap.
 * On failure throws an `EnvValidationError` with a pretty multi-line
 * message listing every offending variable.
 *
 * Playbook §11.1 / [III.11.1].
 */
import type { ZodIssue } from 'zod';
import { EnvSchema, type Env } from './schema';

/** A single env-var issue, flattened from a ZodIssue for easy reporting. */
export interface EnvIssue {
  /** Dotted path of the offending variable (e.g. "DATABASE_URL"). */
  readonly path: string;
  /** Human-readable reason (from Zod). */
  readonly message: string;
  /** The Zod error code (e.g. "invalid_type", "invalid_string"). */
  readonly code: string;
}

/**
 * Thrown by `validateEnv` when one or more env vars fail validation.
 * Preserves the full issues list so callers can render a custom UI
 * (CI failure banner, dev-server overlay, structured log, etc.).
 */
export class EnvValidationError extends Error {
  public readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    const body = issues.map((i) => `  ${i.path || '(root)'}: ${i.message}`).join('\n');
    super(`Invalid environment configuration:\n${body}`);
    this.name = 'EnvValidationError';
    this.issues = issues;

    // Maintains proper prototype chain across transpilation targets.
    Object.setPrototypeOf(this, EnvValidationError.prototype);
  }
}

/**
 * Validate `process.env` (or a caller-supplied object) against the root
 * `EnvSchema`. Returns a fully-typed `Env` on success; throws
 * `EnvValidationError` on failure.
 *
 * Defaults to `process.env` so `const env = validateEnv()` is a valid
 * one-liner in app bootstrap.
 */
export function validateEnv(raw: NodeJS.ProcessEnv | Record<string, unknown> = process.env): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues: EnvIssue[] = result.error.issues.map(toIssue);
    throw new EnvValidationError(issues);
  }
  return result.data;
}

function toIssue(issue: ZodIssue): EnvIssue {
  return {
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  };
}
