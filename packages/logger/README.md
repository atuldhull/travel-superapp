# @app/logger

Pino-backed structured logger with async trace context and PII redaction.
Installed by prompt `[III.11.6]`. See Playbook §15.2.

## Why

Three guarantees every log line must offer:

1. **Structured.** Always JSON, always with `level`, `time`, `context`, `msg`.
2. **Correlated.** Trace id, user id, request id — automatically attached
   per-request via `AsyncLocalStorage`. No manual plumbing at the call site.
3. **Safe.** A central redact list scrubs authorization headers, cookies,
   tokens, emails, phones, and other PII before serialization. Callers
   can't accidentally log a secret — even if the object passed in contains one.

This package is the single place that policy lives.

## Quick start

```ts
import { createLogger, runWithTraceContext } from '@app/logger';

const log = createLogger('places-module');

runWithTraceContext({ traceId: 'trace-abc', userId: 'u-1' }, () => {
  log.info({ radiusKm: 5 }, 'places_searched');
  // → {"level":"info","time":"2026-04-18T…","context":"places-module",
  //    "radiusKm":5,"traceId":"trace-abc","userId":"u-1","msg":"places_searched"}
});
```

## NestJS integration

```ts
// apps/api/src/main.ts
import './instrumentation'; // OTel first — [III.15.4]
import { NestFactory } from '@nestjs/core';
import { AppNestLoggerService } from '@app/logger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppNestLoggerService));
  await app.listen(3000);
}
bootstrap();
```

```ts
// apps/api/src/app.module.ts
@Module({ providers: [AppNestLoggerService], exports: [AppNestLoggerService] })
export class AppModule {}
```

## API

| Export                          | What                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| `createLogger(ctx, opts?)`      | Returns a configured `pino.Logger` (typed as `AppLogger`).                 |
| `AppLogger`                     | `pino.Logger` re-export — use as the type in `.ts` signatures.             |
| `LogLevel`                      | `'silent' \| 'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` |
| `CreateLoggerOptions`           | `{ level?, additionalRedactPaths?, base?, destination?, pretty? }`         |
| `runWithTraceContext(ctx, fn)`  | Enter a new trace scope; every log inside merges the context.              |
| `extendTraceContext(patch, fn)` | Merge extra fields into the current scope (mints traceId if absent).       |
| `getTraceContext()`             | Read the current scope (read-only; `undefined` if none).                   |
| `generateTraceId()`             | 128-bit random hex (W3C `trace-id` shape).                                 |
| `generateSpanId()`              | 64-bit random hex (W3C `span-id` shape).                                   |
| `PII_REDACT_PATHS`              | Frozen array of Pino redact paths — see `src/redact.ts`.                   |
| `AppNestLoggerService`          | `LoggerService` implementation for `app.useLogger(...)`.                   |

## Redaction policy

Field names redacted at the top level **and** one level deep under any
parent key (see `src/redact.ts` for the exhaustive list):

- `password`, `newPassword`, `currentPassword`
- `token`, `accessToken`, `refreshToken`, `idToken`
- `apiKey`, `secret`, `mfaSecret`, `backupCode(s)`
- `email`, `emailHash`, `phone`, `ssn`, `passport`, `creditCard`, `cvv`
- HTTP headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`

Each redacted field is replaced with the literal string `[REDACTED]`.
Add project-wide paths via PR to `src/redact.ts`; use
`additionalRedactPaths` only for one-off call-sites.

## Trace context fields

| Field       | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `traceId`   | 128-bit hex, W3C-compatible. Required.           |
| `spanId`    | 64-bit hex. Optional (set by OTel wiring).       |
| `userId`    | Authenticated user id. Populated by auth guard.  |
| `requestId` | Inbound request id header (e.g. `x-request-id`). |
| `tags`      | Freeform key/value merged into every line.       |

## Scripts

| Command                                | What                                      |
| -------------------------------------- | ----------------------------------------- |
| `pnpm --filter=@app/logger build`      | CJS + d.ts → `dist/`                      |
| `pnpm --filter=@app/logger typecheck`  | `tsc --noEmit`                            |
| `pnpm --filter=@app/logger lint`       | ESLint via `@app/eslint-config`           |
| `pnpm --filter=@app/logger test`       | Jest (ts-jest, in-memory writable stream) |
| `pnpm --filter=@app/logger test:watch` | Jest watch                                |

## Not in this package (yet)

- **`pino-http` middleware** — lives with `apps/api` once that's
  scaffolded; it depends on Fastify request/reply types.
- **Log sinks** (Grafana Loki, Sentry) — wired in
  `@app/observability` + `apps/api/src/main.ts`.
- **Sampling** — handled at the OpenTelemetry export layer, not here.

## See also

- Playbook §15.2 — the original PII/logging policy.
- Prompt `[III.15.4]` — OpenTelemetry tracing wiring that populates `spanId`.
- Prompt `[III.15.1]` — `@app/errors`; call `logger.error({err: err.toJSON()}, 'msg')` to log them safely.
