# syntax=docker/dockerfile:1.7
#
# Production Dockerfile for apps/crawler-worker.
#
# Same 3-stage shape as the other workers. Crawler will eventually
# need Playwright + Chromium baked into the image — when that lands
# the runner stage switches FROM `mcr.microsoft.com/playwright`
# (or similar) and keeps the rest of the build identical.
#
# Build (from repo root):
#   docker build -f apps/crawler-worker/Dockerfile -t travel-crawler-worker:latest .
#
# Installed by [Q4] of the Scale-readiness 3→10 series.

FROM node:22.12.0-alpine AS deps

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/crawler-worker/package.json apps/crawler-worker/
COPY packages/jobs/package.json packages/jobs/
COPY packages/logger/package.json packages/logger/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/

RUN pnpm fetch --frozen-lockfile

FROM node:22.12.0-alpine AS builder

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=deps /workspace /workspace
COPY . .

RUN pnpm install --frozen-lockfile --offline

RUN pnpm turbo run build --filter='@app/jobs' --filter='@app/logger' --filter=crawler-worker

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

COPY --from=builder /workspace/apps/crawler-worker/dist ./apps/crawler-worker/dist
COPY --from=builder /workspace/apps/crawler-worker/package.json ./apps/crawler-worker/
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/crawler-worker/node_modules ./apps/crawler-worker/node_modules
COPY --from=builder /workspace/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /workspace/packages/jobs/package.json ./packages/jobs/
COPY --from=builder /workspace/packages/logger/dist ./packages/logger/dist
COPY --from=builder /workspace/packages/logger/package.json ./packages/logger/

ENV NODE_ENV=production

USER nonroot

CMD ["apps/crawler-worker/dist/main.js"]
