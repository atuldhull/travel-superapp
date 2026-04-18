# api

NestJS 11 + Fastify modular monolith. Installed by prompt `[III.11.0]`.

## What's wired

| Concern            | How                                                                           | Where                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Env validation     | Zod via `@app/config` → `validateEnv()`                                       | `src/main.ts` (fail-fast at boot)           |
| Global config (DI) | `AppConfigModule.forRoot()` from `@app/config`                                | `src/app.module.ts`                         |
| Structured logging | `AppNestLoggerService` from `@app/logger` (Pino + trace context + PII redact) | `src/main.ts` `app.useLogger(...)`          |
| Domain errors      | `@app/errors` imported and ready for use                                      | — (throw from use cases once modules exist) |
| HTTP adapter       | Fastify 5 via `@nestjs/platform-fastify@11`                                   | `src/main.ts`                               |
| URL prefix         | `/api/v1/*` for business routes, `/health/*` bare                             | `app.setGlobalPrefix(..., { exclude })`     |
| Shutdown           | `app.enableShutdownHooks()` — clean SIGTERM handling for Fly.io / k8s         | `src/main.ts`                               |
| Health probe       | `GET /health/live` — 200 with `{status, service, timestamp, uptimeSeconds}`   | `src/health/health.controller.ts`           |
| OTel stub          | `../instrumentation.ts` imported line 1 of main.ts                            | real SDK in `[III.15.4]`                    |

## Scripts

| Command                       | What                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `pnpm --filter=api dev`       | Hot-reload dev server via tsx (`src/main.ts` → SIGTERM restart) |
| `pnpm --filter=api build`     | `tsc -p tsconfig.build.json` → `dist/`                          |
| `pnpm --filter=api start`     | `node dist/main.js` (after build)                               |
| `pnpm --filter=api typecheck` | `tsc --noEmit`                                                  |
| `pnpm --filter=api lint`      | ESLint via `@app/eslint-config`                                 |
| `pnpm --filter=api test`      | Jest e2e via Fastify `inject()` (no real port)                  |

## Local run

1. Make sure the dev stack is healthy: `docker compose -f infra/docker-compose.yml ps`
2. Export env (or use Doppler once wired): copy values from `infra/README.md`.
3. `pnpm --filter=api dev` → logs show `api_started port=<n>`.
4. `curl http://localhost:<PORT>/health/live` → `{"status":"ok",…}`.

## What's NOT here yet

Each of these has its own upcoming prompt:

| Coming in      | Adds                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| `[III.11.3]`   | JWT + RBAC guards (`JwtAuthGuard`, `RolesGuard`)                            |
| `[III.11.4]`   | Redis sliding-window rate limiter                                           |
| `[III.11.5]`   | `DomainExceptionFilter` mapping `@app/errors` → HTTP                        |
| `[III.11.7]`   | `@FeatureFlag` + strategy registries + versioning helpers                   |
| `[III.13.1]`   | `ZodValidationPipe`                                                         |
| `[III.13.8]`   | CSRF + Helmet + strict CSP                                                  |
| `[III.15.3]`   | `prom-client` metrics at `/metrics`                                         |
| `[III.15.4]`   | Real OpenTelemetry SDK in `instrumentation.ts`                              |
| `[III.15.8]`   | Auto-generated Swagger at `/api/docs`                                       |
| `[IV.18.1.16]` | `@nestjs/terminus` `/health/ready` + `/health/startup` with real dep checks |

Keep this README in sync as each lands.
