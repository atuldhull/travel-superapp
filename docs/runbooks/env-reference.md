# Runbook: environment variable reference

> Installed by prompt `[IV.18.19.8]`. Sourced from
> [`packages/config/src/schema.ts`](../../packages/config/src/schema.ts)
> as of commit `[main HEAD on 2026-04-26]`. Companion to
> [`docs/runbooks/secrets.md`](./secrets.md) for the management /
> rotation story.
>
> If this file falls out of sync with the schema, the schema wins.
> The startup `EnvValidationError` from `validateEnv()` will catch
> any missing required var; this doc is for humans setting things
> up.

## At a glance

- **15 required vars** for the API to boot. Missing any one →
  `EnvValidationError` at startup.
- **~25 optional vars** for OAuth providers, Stripe, external APIs,
  AI keys, observability, feature flags. Boot succeeds without them;
  the corresponding feature is just disabled.
- **3 peppers** (RATE_LIMIT, EMAIL, BACKUP_CODE) MUST be ≥ 32 chars
  for any non-toy deployment.

## Required (boot fails without these)

### Runtime

| Var         | Type                                              | Default       | What it does                                                                                   |
| ----------- | ------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `NODE_ENV`  | `development` / `test` / `staging` / `production` | `development` | Drives a few branches (purge scheduler skip-in-test, default cache prefixes, log destination). |
| `PORT`      | int                                               | `3000`        | HTTP listen port. Bound on `0.0.0.0`.                                                          |
| `LOG_LEVEL` | pino level                                        | `info`        | `silent` / `trace` / `debug` / `info` / `warn` / `error` / `fatal`.                            |

### Database

| Var                 | Type    | Default | What it does                                                                        |
| ------------------- | ------- | ------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`      | URL     | —       | Postgres 16 + PostGIS + pgvector. Includes credentials in the URL.                  |
| `DATABASE_POOL_MIN` | int ≥ 0 | `2`     | Prisma connection pool min size.                                                    |
| `DATABASE_POOL_MAX` | int > 0 | `10`    | Prisma connection pool max size. Tune up only after measuring P99 + idle pool wait. |

### Redis

| Var         | Type | Default | What it does                                                                                          |
| ----------- | ---- | ------- | ----------------------------------------------------------------------------------------------------- |
| `REDIS_URL` | URL  | —       | Cache / rate limits / sessions / streams. Single instance for now; cluster URL is a future migration. |

### JWT

| Var                  | Type              | Default | What it does                                                                                             |
| -------------------- | ----------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | string ≥ 32 chars | —       | Signs short-lived (15m) access tokens. Rotate quarterly.                                                 |
| `JWT_REFRESH_SECRET` | string ≥ 32 chars | —       | Signs long-lived (30d) refresh tokens stored as httpOnly cookie. Rotation forces every user to re-login. |
| `JWT_ACCESS_EXPIRY`  | duration          | `15m`   | Access token TTL. Lower = better security; higher = less refresh churn.                                  |
| `JWT_REFRESH_EXPIRY` | duration          | `30d`   | Refresh token TTL.                                                                                       |

### Storage (S3-compatible)

| Var             | Type   | Default     | What it does                                                           |
| --------------- | ------ | ----------- | ---------------------------------------------------------------------- |
| `S3_ENDPOINT`   | URL    | —           | MinIO in dev, R2/S3 in prod. Path-style URLs (`forcePathStyle: true`). |
| `S3_BUCKET`     | string | —           | Single bucket per environment; key prefixes within it.                 |
| `S3_ACCESS_KEY` | string | —           | IAM-style access key.                                                  |
| `S3_SECRET_KEY` | string | —           | IAM-style secret.                                                      |
| `S3_REGION`     | string | `us-east-1` | Signing region. MinIO ignores this; real S3 / R2 enforce it.           |

### Meilisearch

| Var                | Type              | Default                 | What it does                                                                    |
| ------------------ | ----------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `MEILI_HOST`       | URL               | `http://localhost:7700` | Meili instance URL.                                                             |
| `MEILI_MASTER_KEY` | string ≥ 16 chars | —                       | Master API key. Tenant tokens are derived from it; never expose to the browser. |

### Security peppers

| Var                  | Type              | Default | What it does                                                                                                     |
| -------------------- | ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `RATE_LIMIT_PEPPER`  | string ≥ 32 chars | —       | Pepper for IP-hash buckets in the rate limiter. Rotation flushes buckets; clients see one cycle of free retries. |
| `EMAIL_PEPPER`       | string ≥ 32 chars | —       | Pepper for sha256-hashed email lookups. Rotation requires a dual-write migration (see `secrets.md`).             |
| `BACKUP_CODE_PEPPER` | string ≥ 32 chars | —       | Pepper for sha256-hashed MFA backup codes. Rotation invalidates every outstanding code.                          |

### CORS

| Var            | Type                    | Default                        | What it does                                                            |
| -------------- | ----------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `CORS_ORIGINS` | comma-separated origins | `''` (empty = no cross-origin) | Wildcards intentionally not supported; list each dev origin explicitly. |

## Optional (feature gates)

### OAuth — Google

Set both or neither; partial config = boot succeeds, sign-in route 503s.

| Var                    | What                 |
| ---------------------- | -------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth2 client id     |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |

### OAuth — Apple

| Var                 | What                                                         |
| ------------------- | ------------------------------------------------------------ |
| `APPLE_CLIENT_ID`   | Service id (`com.example.travel`)                            |
| `APPLE_TEAM_ID`     | Apple developer team id                                      |
| `APPLE_KEY_ID`      | Sign-in-with-Apple key id                                    |
| `APPLE_PRIVATE_KEY` | PEM-encoded private key (multiline; URL-encode in env files) |

### AI

| Var              | What                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `CLAUDE_API_KEY` | Anthropic API key — primary LLM. Used by `[IV.18.x]` itinerary generation when wired.             |
| `OPENAI_API_KEY` | Fallback LLM.                                                                                     |
| `AI_SERVICE_URL` | Python FastAPI sidecar (NLLB / Whisper / DistilBERT / crowd ML). Default `http://localhost:8001`. |

### Stripe

| Var                        | What                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`        | Server-side Stripe key. Required for the payments module to come online. |
| `STRIPE_WEBHOOK_SECRET`    | Webhook signing secret.                                                  |
| `STRIPE_CONNECT_CLIENT_ID` | Marketplace / agent escrow Connect platform id.                          |

### External APIs

| Var                     | What                  |
| ----------------------- | --------------------- |
| `GOOGLE_PLACES_API_KEY` | Federation source #1. |
| `FOURSQUARE_API_KEY`    | Federation source #2. |
| `MAPBOX_ACCESS_TOKEN`   | Web + RN map tiles.   |

### Communications

| Var                  | What                       |
| -------------------- | -------------------------- |
| `RESEND_API_KEY`     | Email transactional sends. |
| `TWILIO_ACCOUNT_SID` | SMS / voice.               |
| `TWILIO_AUTH_TOKEN`  | Twilio auth.               |
| `TWILIO_FROM_NUMBER` | E.164 number.              |

### Observability

| Var                           | What                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint. Without it, traces stay in-process. |
| `SENTRY_DSN`                  | Sentry error reporting.                                               |
| `POSTHOG_API_KEY`             | Product analytics.                                                    |

### Feature flags (boolean — accepts `true`/`1`/`yes`)

| Var                       | Default | What                                                         |
| ------------------------- | ------- | ------------------------------------------------------------ |
| `FEATURE_3D_ENABLED`      | `false` | Toggle 3D place previews (gated on the Google 3D Tiles API). |
| `FEATURE_SATELLITE_CROWD` | `false` | Toggle satellite-image-based crowd estimation.               |

## Generating dev-quality values

```sh
# 32-char hex (256 bits of entropy) for the JWT / pepper vars.
openssl rand -hex 32

# 16-char hex for MEILI_MASTER_KEY.
openssl rand -hex 16
```

Stash these in Doppler's `dev` config — never in repo files.

## Changing this doc

When the schema gains / loses a var, update this file in the same
PR. The schema is the source of truth; this doc is for humans, not
machines. The CI lint job does NOT verify these tables match the
schema; that's a future enhancement (`scripts/verify-env-doc.ts`).

## Cross-references

- [`docs/runbooks/secrets.md`](./secrets.md) — Doppler bootstrap +
  rotation cadence
- [`packages/config/src/schema.ts`](../../packages/config/src/schema.ts)
  — Zod schema that validates these at startup
- [`docs/runbooks/dockerfile.md`](./dockerfile.md) — production
  invocation passes these via `-e`
