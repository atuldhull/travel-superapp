/**
 * Zod-backed NestJS ValidationPipe.
 *
 * Pairs with `DomainExceptionFilter` ([III.11.5]) and `@app/errors`:
 *   pipe throws `ValidationError` on any mismatch → filter renders a
 *   422 with the `fieldErrors` map in the JSON body.
 *
 * Design
 *   - Typed: `new ZodValidationPipe(MyZodSchema)` makes downstream
 *     handlers receive `z.infer<typeof MyZodSchema>`.
 *   - Strict by default: if the schema is a `ZodObject`, the pipe
 *     wraps it with `.strict()` so unknown keys raise an error
 *     (Zod's default is to silently strip them). Callers who want
 *     passthrough can wrap with `.passthrough()` themselves BEFORE
 *     handing to the pipe — `.strict()` is applied only to plain
 *     ZodObject instances.
 *   - Only validates `body` / `query` / `param` arguments. Nest-internal
 *     `custom`/`metatype` types pass through untouched.
 *   - `unrecognized_keys` issues are expanded into a per-key map so
 *     clients see `{ extra: ['unrecognized key'] }` rather than
 *     `{ '(root)': ['Unrecognized key(s) in object: \\'extra\\''] }`.
 *
 * Usage
 *   @Post()
 *   createTrip(@Body(new ZodValidationPipe(CreateTripSchema)) dto: CreateTripDto) {
 *     // dto is fully typed and validated.
 *   }
 *
 * Installed by prompt [III.13.1]. See Playbook §13.1.
 */
import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodIssue, ZodTypeAny, infer as ZodInfer } from 'zod';
import { ValidationError } from '@app/errors';

/** Duck-typed check for a plain `ZodObject` without invoking the class
 *  constructor at runtime — avoids `instanceof` generic-arg friction in
 *  strict TypeScript. */
interface ZodObjectLike<T extends ZodTypeAny> {
  _def: { typeName: string };
  strict(): T;
}
function isZodObjectLike<T extends ZodTypeAny>(s: T): s is T & ZodObjectLike<T> {
  return (
    typeof s === 'object' &&
    s !== null &&
    (s as { _def?: { typeName?: unknown } })._def?.typeName === 'ZodObject'
  );
}

/** Metadata `type` values for which we actually run validation. */
const VALIDATED_ARG_TYPES: ReadonlySet<ArgumentMetadata['type']> = new Set([
  'body',
  'query',
  'param',
]);

@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny = ZodTypeAny> implements PipeTransform<
  unknown,
  ZodInfer<T>
> {
  private readonly schema: T;

  constructor(schema: T) {
    // Upgrade plain ZodObject to `.strict()` so unknown keys are rejected.
    // `.strict()` is idempotent; calling on an already-strict schema is a
    // no-op. Non-object schemas (primitives, unions, intersections, arrays)
    // pass through unchanged.
    this.schema = isZodObjectLike(schema) ? schema.strict() : schema;
  }

  transform(value: unknown, metadata: ArgumentMetadata): ZodInfer<T> {
    if (!VALIDATED_ARG_TYPES.has(metadata.type)) {
      return value as ZodInfer<T>;
    }

    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data as ZodInfer<T>;
    }

    throw new ValidationError('Validation failed', zodIssuesToFieldErrors(result.error.issues), {
      source: metadata.type,
      field: metadata.data ?? null,
    });
  }
}

/**
 * Convert a list of Zod issues into the `fieldErrors` shape that
 * `ValidationError` accepts. Handles `unrecognized_keys` specially so
 * each offending key ends up in its own entry.
 */
function zodIssuesToFieldErrors(issues: readonly ZodIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const push = (key: string, message: string): void => {
    const target = out[key];
    if (target) {
      target.push(message);
    } else {
      out[key] = [message];
    }
  };

  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      const parent = issue.path.join('.');
      const unknownKeys = (issue as { keys?: readonly string[] }).keys ?? [];
      for (const key of unknownKeys) {
        push(parent ? `${parent}.${key}` : key, 'unrecognized key');
      }
      continue;
    }
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    push(path, issue.message);
  }

  return out;
}
