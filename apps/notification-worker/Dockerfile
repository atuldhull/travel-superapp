# syntax=docker/dockerfile:1.7
#
# Production Dockerfile for apps/notification-worker.
#
# Same 3-stage shape as apps/api/Dockerfile — keeps every container
# image in this repo predictable. Smaller than the api image because
# the worker pulls a narrower workspace surface (just @app/jobs and
# @app/logger; no Prisma, no Fastify).
#
# Build (from repo root):
#   docker build -f apps/notification-worker/Dockerfile -t travel-notification-worker:latest .
#
# Run:
#   docker run --rm -e REDIS_URL=... travel-notification-worker:latest
#
# Installed by [Q4] of the Scale-readiness 3→10 series.

# ─── Stage 1: deps ──────────────────────────────────────────────
FROM node:22.12.0-alpine AS deps

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy lockfile + relevant manifests. We only need the workspace
# packages this worker imports, plus their transitive workspace
# dependencies. Listed explicitly so deps stays cache-friendly.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/notification-worker/package.json apps/notification-worker/
COPY packages/jobs/package.json packages/jobs/
COPY packages/logger/package.json packages/logger/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/

RUN pnpm fetch --frozen-lockfile

# ─── Stage 2: builder ───────────────────────────────────────────
FROM node:22.12.0-alpine AS builder

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=deps /workspace /workspace
COPY . .

RUN pnpm install --frozen-lockfile --offline

# Build @app/jobs + @app/logger (workspace deps) + the worker itself.
RUN pnpm turbo run build --filter='@app/jobs' --filter='@app/logger' --filter=notification-worker

# ─── Stage 3: runner (distroless) ───────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

COPY --from=builder /workspace/apps/notification-worker/dist ./apps/notification-worker/dist
COPY --from=builder /workspace/apps/notification-worker/package.json ./apps/notification-worker/
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/notification-worker/node_modules ./apps/notification-worker/node_modules
COPY --from=builder /workspace/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /workspace/packages/jobs/package.json ./packages/jobs/
COPY --from=builder /workspace/packages/logger/dist ./packages/logger/dist
COPY --from=builder /workspace/packages/logger/package.json ./packages/logger/

ENV NODE_ENV=production

USER nonroot

# Workers don't bind a port — they consume from Redis. No EXPOSE.

CMD ["apps/notification-worker/dist/main.js"]
