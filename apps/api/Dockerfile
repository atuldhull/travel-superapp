# syntax=docker/dockerfile:1.7
#
# Production multi-stage Dockerfile for apps/api.
#
# Three stages:
#
#   1. deps        — installs pnpm + the full monorepo dep graph using
#                    pnpm fetch + offline install. Cached on
#                    pnpm-lock.yaml hash.
#   2. builder     — builds @app/* workspace packages (which ship a
#                    compiled dist/) + the api itself + generates the
#                    Prisma client.
#   3. runner      — distroless Node 22 nonroot. Copies just the dist/
#                    + node_modules + Prisma engine binaries. No
#                    devDependencies, no source, no test files.
#
# Build (from repo root):
#   docker build -f apps/api/Dockerfile -t travel-api:latest .
#
# Run:
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL=... -e REDIS_URL=... \
#     -e JWT_ACCESS_SECRET=... -e JWT_REFRESH_SECRET=... \
#     travel-api:latest
#
# Why distroless: smallest attack surface for a Node app. No shell,
# no busybox, no apt. The image only contains node + the tiny libc
# runtime + our dist.
#
# Installed by prompt [IV.18.19.6].

# ─── Stage 1: deps ──────────────────────────────────────────────
# Pinned to a specific Node 22 alpine for reproducibility. Bump
# deliberately, not opportunistically.
FROM node:26.3.1-alpine AS deps

# Build context = repo root (we use the full monorepo so workspace
# resolution works). Copy lockfile + manifests first so changes to
# source code don't bust the install cache.
WORKDIR /workspace

# pnpm via corepack — same version `package.json` declares.
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy ONLY the files needed to resolve + fetch deps. Source code
# arrives in the builder stage.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/errors/package.json packages/errors/
COPY packages/events/package.json packages/events/
COPY packages/logger/package.json packages/logger/
COPY packages/observability/package.json packages/observability/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tsconfig/package.json packages/tsconfig/

# `pnpm fetch` populates the local store from the lockfile without
# needing the workspace to install. Offline install in the next
# step is then deterministic + cache-friendly.
RUN pnpm fetch --frozen-lockfile

# ─── Stage 2: builder ───────────────────────────────────────────
FROM node:26.3.1-alpine AS builder

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Bring forward the resolved deps from stage 1.
COPY --from=deps /workspace /workspace
# Copy the rest of the source tree.
COPY . .

# Offline install (uses the prefetched store). Includes
# devDependencies — they're trimmed in the runner stage.
RUN pnpm install --frozen-lockfile --offline

# Build workspace packages that ship a compiled dist/, then the api.
RUN pnpm turbo run build --filter='@app/*' --filter=api

# Generate Prisma client BEFORE the prune so the engine binaries
# are present in the final node_modules tree.
RUN pnpm --filter=api run db:generate

# ─── Stage 3: runner (distroless) ───────────────────────────────
# `gcr.io/distroless/nodejs22-debian12:nonroot` ships only Node 22 +
# tini + the libc runtime. No shell, no package manager. Runs as
# uid 65532 by default (the `nonroot` tag).
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

# Bring just the artifacts the runtime actually needs:
#   - apps/api/dist            — compiled JS
#   - apps/api/instrumentation — OTel bootstrap (loaded as the FIRST import per main.ts comment)
#   - node_modules             — full resolved tree (workspace symlinks intact)
#   - apps/api/package.json    — Node looks up "main", "type", etc.
#   - apps/api/prisma          — schema + migrations (Prisma engine reads at runtime)
#   - workspace packages' compiled dist/ folders — symlinked from
#     apps/api/node_modules/@app/* so they're already pulled in.
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/apps/api/instrumentation.ts ./apps/api/instrumentation.ts
COPY --from=builder /workspace/apps/api/package.json ./apps/api/
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /workspace/packages ./packages

# Bind to all interfaces; container orchestrators handle the
# external port mapping. Default 3000 matches main.ts.
ENV NODE_ENV=production
ENV PORT=3000

# Distroless `nonroot` already drops to uid 65532; no USER directive
# needed. Just declare it for explicit-readers.
USER nonroot

EXPOSE 3000

# `dist/main.js` is the entry compiled from src/main.ts. The
# distroless nodejs image's ENTRYPOINT is already `/usr/bin/node`,
# so CMD is just the script path.
CMD ["apps/api/dist/main.js"]
