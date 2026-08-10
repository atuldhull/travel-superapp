# syntax=docker/dockerfile:1.7
#
# Production multi-stage Dockerfile for apps/web (Next.js 15).
#
# Three stages:
#
#   1. deps     — installs the full monorepo dep graph via
#                 `pnpm fetch` + offline install. Cached on
#                 pnpm-lock.yaml hash.
#   2. builder  — builds @app/* workspace packages (e.g. @app/sdk
#                 ships TS-source-as-package, no compile needed)
#                 and runs `next build` to produce .next/standalone.
#   3. runner   — distroless Node 22 nonroot. Copies just the
#                 standalone server + static + public + node_modules
#                 the standalone tracer collected.
#
# Build (from repo root):
#   docker build -f apps/web/Dockerfile -t travel-web:latest .
#
# Run:
#   docker run --rm -p 3001:3001 \
#     -e NEXT_PUBLIC_API_URL=https://api.example.com \
#     travel-web:latest
#
# `output: 'standalone'` in next.config.js drives the build to emit
# .next/standalone/apps/web/server.js as a self-contained launcher.
# `outputFileTracingRoot` is set to the monorepo root so workspace
# packages (@app/sdk) are traced into the standalone bundle.
#
# Installed by prompt [IV.18.19.19].

# ─── Stage 1: deps ──────────────────────────────────────────────
FROM node:26.7.0-alpine AS deps

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy ONLY the manifests + lockfile so source changes don't bust
# the install cache.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/sdk/package.json packages/sdk/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/

RUN pnpm fetch --frozen-lockfile

# ─── Stage 2: builder ───────────────────────────────────────────
FROM node:26.7.0-alpine AS builder

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY --from=deps /workspace /workspace
COPY . .

RUN pnpm install --frozen-lockfile --offline

# Build any workspace packages with a build step; @app/sdk ships
# TS source directly so the filter is a no-op for now but keeps the
# command future-proof.
RUN pnpm turbo run build --filter='@app/*' --filter=web

# ─── Stage 3: runner (distroless) ───────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

# Next standalone tracer puts everything it needs under
# .next/standalone (workspace siblings included via
# outputFileTracingRoot). Static assets live separately.
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
# `public/` is optional today (no static assets yet) but copying it
# is cheap and future-proofs the image.
COPY --from=builder /workspace/apps/web/public ./apps/web/public 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

USER nonroot

EXPOSE 3001

# Standalone server launcher. The path mirrors the workspace
# layout because Next preserves it under .next/standalone.
CMD ["apps/web/server.js"]
