# @app/config

Zod-validated environment configuration for TravelSuperApp.
Installed by prompt `[III.11.1]`. See Playbook §11.1.

## Why

Every app bootstraps from `process.env`. Unvalidated env = silent
production incidents. This package is the single place where we enforce:

- which variables are required,
- their types (URLs, numbers, enums, secrets of a minimum length),
- sensible defaults for dev,
- a human-readable failure mode (list of every offending key) when
  something is wrong.

## Quick start

### Framework-agnostic (scripts, workers, ai-service proxies)

```ts
import { validateEnv } from '@app/config';

const env = validateEnv(); // throws EnvValidationError on any invalid var
startServer(env);
```

### NestJS (apps/api, notification-worker, crawler-worker)

```ts
// main.ts
import './instrumentation'; // OTel first — see [III.15.4]
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';

@Module({
  imports: [AppConfigModule.forRoot()],
})
export class AppModule {}
```

```ts
// any service
import { Injectable } from '@nestjs/common';
import type { AppConfigService } from '@app/config';

@Injectable()
export class ExampleService {
  constructor(private readonly config: AppConfigService) {}

  connect() {
    const url = this.config.get('DATABASE_URL', { infer: true });
    // url is typed as string
    return openDatabase(url);
  }
}
```

## Schema overview

Variables are grouped by concern in `src/schema.ts`:

| Group                             | Required                                             | Notable                                                     |
| --------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Runtime                           | NODE_ENV default `development`                       | PORT default 3000, LOG_LEVEL default `info`                 |
| Database                          | DATABASE_URL                                         | POOL_MIN=2, POOL_MAX=10 defaults                            |
| Redis                             | REDIS_URL                                            | —                                                           |
| JWT                               | JWT_ACCESS_SECRET + JWT_REFRESH_SECRET (≥ 32 chars)  | expiries default 15m / 30d                                  |
| Google OAuth                      | — (optional)                                         | app can boot without                                        |
| Apple OAuth                       | — (optional)                                         | app can boot without                                        |
| AI                                | AI_SERVICE_URL default `http://localhost:8001`       | CLAUDE/OPENAI keys optional                                 |
| Stripe                            | — (optional until payments)                          |                                                             |
| External APIs (Places/FSQ/Mapbox) | — (optional)                                         |                                                             |
| Storage (S3)                      | S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY | REGION default us-east-1                                    |
| Comms (Resend/Twilio)             | — (optional)                                         |                                                             |
| Meilisearch                       | MEILI_MASTER_KEY (≥ 16 chars)                        | HOST default `http://localhost:7700`                        |
| Observability                     | — (optional)                                         | OTEL/Sentry/PostHog all optional                            |
| Features                          | —                                                    | FEATURE_3D_ENABLED, FEATURE_SATELLITE_CROWD — default false |
| Security                          | RATE_LIMIT_PEPPER (≥ 32 chars)                       | Salts rate-limit keys in Redis                              |

## Error shape

```ts
class EnvValidationError extends Error {
  issues: ReadonlyArray<{ path: string; message: string; code: string }>;
}
```

The `message` contains a rendered multi-line block; `issues` gives
the structured form for tooling.

## Scripts

| Command                                | What                                            |
| -------------------------------------- | ----------------------------------------------- |
| `pnpm --filter=@app/config build`      | Emit CJS + d.ts into `dist/` (consumed by apps) |
| `pnpm --filter=@app/config typecheck`  | `tsc --noEmit`                                  |
| `pnpm --filter=@app/config lint`       | ESLint via `@app/eslint-config`                 |
| `pnpm --filter=@app/config test`       | Jest (ts-jest, CommonJS transform)              |
| `pnpm --filter=@app/config test:watch` | Jest watch mode                                 |

## Conventions

- `workspace:*` for internal deps (`@app/tsconfig`, `@app/eslint-config`).
- `peerDependencies` for NestJS and reflect-metadata so consumers control
  the exact NestJS version; the module is optional for non-Nest callers.
- Ships CJS from `dist/` — avoids ESM-vs-CJS friction with NestJS runtime.
- No runtime Node imports besides what Zod needs; safe to use in
  workers and edge-ish contexts.

## See also

- Playbook §11.1 (this package's spec).
- Playbook §13.2 (why JWT secrets are ≥ 32 chars and why we'll rotate via JWKS).
- Playbook §13.4 (why RATE_LIMIT_PEPPER exists).
- `[IX.32.4]` — the matching `.env.example` covering every variable above.
