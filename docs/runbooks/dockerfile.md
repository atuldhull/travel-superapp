# Runbook: `apps/api` Dockerfile

> Installed by prompt `[IV.18.19.6]`. See [`apps/api/Dockerfile`](../../apps/api/Dockerfile)
>
> - [`apps/api/.dockerignore`](../../apps/api/.dockerignore).

## Invariants

The image MUST satisfy every line below. Deploy gate breaks if any
of these regresses.

| Invariant                                                             | Why                                                      | How to verify                                                                                                                                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Multi-stage build** (deps → builder → runner)                       | devDependencies + source never reach the runtime image   | `docker history travel-api:latest` shows three stages                                                                                                                                             |
| **Distroless runner** (`gcr.io/distroless/nodejs22-debian12:nonroot`) | No shell, no package manager → minimal attack surface    | `docker run --rm --entrypoint=/bin/sh travel-api:latest -c 'echo'` should fail                                                                                                                    |
| **Non-root user** (uid 65532)                                         | OWASP Mobile / container hardening                       | `docker run --rm travel-api:latest` and check `id` is not root (won't work in distroless; verified via inspect: `docker inspect --format '{{.Config.User}}' travel-api:latest` returns `nonroot`) |
| **No `.env*` files baked in**                                         | Secrets live in Doppler, never in images                 | `docker run --rm --entrypoint=/usr/bin/find travel-api:latest -name '.env*'` returns nothing (use a debug image variant; not possible against pure distroless)                                    |
| **No `node_modules/.cache`**                                          | Reduces image size                                       | grep image layer for `.cache`                                                                                                                                                                     |
| **Pinned base versions**                                              | Reproducible rebuilds; deliberate upgrades               | `grep -E 'FROM (node                                                                                                                                                                              | gcr.io)' apps/api/Dockerfile` shows pinned tags |
| **Prisma engine binaries present**                                    | Runtime queries fail without them                        | `docker run ... travel-api:latest` boots without `Cannot find module @prisma/client`                                                                                                              |
| **OTel instrumentation loads first**                                  | Auto-instrumentation requires hooking before app imports | `apps/api/instrumentation.ts` is copied into runner; `main.ts` imports it as line 1                                                                                                               |

## Build

```sh
# From repo root (NOT from apps/api/ — context is the workspace).
docker build -f apps/api/Dockerfile -t travel-api:latest .
```

Build time on a clean cache: ~3–4 min. Subsequent rebuilds are
near-instant if only source code changed (the `deps` stage caches
on `pnpm-lock.yaml`).

## Run

```sh
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://travel:travel_dev@host.docker.internal:5432/travel_dev \
  -e REDIS_URL=redis://:redis_dev@host.docker.internal:6379 \
  -e S3_ENDPOINT=http://host.docker.internal:9000 \
  -e S3_BUCKET=travel-test \
  -e S3_ACCESS_KEY=minio \
  -e S3_SECRET_KEY=minio_password \
  -e JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
  -e JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  -e MEILI_MASTER_KEY=$(openssl rand -hex 16) \
  -e RATE_LIMIT_PEPPER=$(openssl rand -hex 32) \
  -e CORS_ORIGINS='' \
  travel-api:latest
```

`host.docker.internal` resolves to the host on Docker Desktop
(macOS / Windows). On Linux, add `--add-host=host.docker.internal:host-gateway`.

## Smoke test the running image

```sh
curl -fs localhost:3000/health/live
curl -fs localhost:3000/health/ready
curl -fs localhost:3000/metrics | head -20
```

If any of these fail, the image isn't ready for promotion to staging.

## Size baseline

| Stage     | Approx. size                                                         |
| --------- | -------------------------------------------------------------------- |
| `deps`    | ~400 MB (full pnpm store + alpine)                                   |
| `builder` | ~1.2 GB (full source + all node_modules)                             |
| `runner`  | **~280 MB** (distroless + dist + prod node_modules + Prisma engines) |

If the runner image grows past ~350 MB, audit recent dep additions
or COPY layers — something likely landed that shouldn't.

## Migrations

The image does NOT run migrations on start. Apply them out-of-band
in CI/CD before promoting traffic:

```sh
docker run --rm \
  -e DATABASE_URL=$STAGING_DATABASE_URL \
  --entrypoint /usr/bin/node \
  travel-api:latest \
  apps/api/node_modules/prisma/build/index.js migrate deploy
```

(Distroless ships only `node` — no `pnpm` / `npx`. Invoke prisma
directly via its `build/index.js` entry.)

## Common failure modes

| Symptom                                   | Cause                                                                 | Fix                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `Cannot find module '@prisma/client'`     | Prisma generate didn't run in builder                                 | Re-run `pnpm --filter=api run db:generate` in builder stage             |
| `EnvValidationError` at boot              | Missing required env var                                              | Compare against `packages/config/src/schema.ts`; add the missing var    |
| 502 from load balancer with image healthy | App bound to `127.0.0.1` instead of `0.0.0.0`                         | Verify `main.ts` calls `app.listen(env.PORT, '0.0.0.0')`                |
| Image ~1.2 GB                             | runner accidentally copying from `builder` stage's `/workspace` whole | Each `COPY --from=builder` should target specific paths, never the root |

## Future work

- Add a `--target debug` variant with shell + curl baked in for live
  troubleshooting (separate image, NEVER promoted to prod).
- SBOM generation via `syft` in CI (feeds the security scanner).
- Image signing via cosign once the registry decision is made.
- Trivy scan integrated into the security workflow `[IV.18.19.3]`
  already covers fs-scan; add image-scan when the prod registry
  exists.
