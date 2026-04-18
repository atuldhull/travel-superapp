# TravelSuperApp — Progress Log

> Rolling log of completed prompts from [`travel-app-prompts.md`](./travel-app-prompts.md). Newest at the top.
>
> **Update rule:** every prompt execution ends with a new row here + a commit.
>
> **Legend:** status = `DONE` (finished & verified) · `IN-PROGRESS` (started, not finished) · `BLOCKED` (waiting on user/ext) · `REVERTED` (rolled back).

---

## Summary

| Counter             | Value                                                |
| ------------------- | ---------------------------------------------------- |
| Prompts completed   | 3                                                    |
| Prompts in progress | 0                                                    |
| Prompts blocked     | 0                                                    |
| Last prompt         | `[IX.32.2]`                                          |
| Last commit date    | 2026-04-18                                           |
| Phase               | Phase 0 — Foundation (monorepo + local dev stack up) |

---

## Log (newest first)

---

### [IX.32.2] — Docker Compose local dev stack (8 services, all healthy)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 32.2

**What was done**

- Authored `infra/docker-compose.yml` — 8 services, each with healthcheck + named volume where it holds state. Stack name `travel-superapp-dev`. Modern Compose syntax (no `version:` key).
- Services + ports:
  - **postgres** (built from `./postgres/Dockerfile` on top of `postgis/postgis:16-3.4`, pgvector layered via `postgresql-16-pgvector` apt) — `localhost:5432`. Init scripts mounted from `./postgres/init/`.
  - **redis** (`redis:7.4-alpine`, `--requirepass redis_dev`) — `localhost:6379`.
  - **meilisearch** (`v1.11`) — `localhost:7700`.
  - **minio** (`RELEASE.2024-12-18T13-15-44Z`) — API `:9000`, console `:9001`.
  - **mailpit** (`v1.21`) — SMTP `:1025`, UI `:8025`.
  - **jaeger** (`all-in-one:1.65.0`) — UI `:16686`, OTLP gRPC `:4317`, HTTP `:4318`.
  - **prometheus** (`v3.1.0`) — `:9090`, config mounted from `./prometheus/prometheus.yml`.
  - **grafana** (`11.4.0`) — `:3001` (avoids Next.js 3000), auto-provisioned datasources + dashboards folder mounted from `./grafana/provisioning/`. Depends on prometheus + jaeger being healthy.
- `infra/postgres/Dockerfile` — extends `postgis/postgis:16-3.4`, `apt-get install postgresql-16-pgvector`. (No single public image bundles PostGIS + pgvector, so we build a small 2-layer one.)
- `infra/postgres/init/01-extensions.sql` — idempotent `CREATE EXTENSION IF NOT EXISTS` for `postgis`, `postgis_topology`, `vector`, `pg_trgm`, `pgcrypto`. Mounted read-only and runs on first boot.
- `infra/prometheus/prometheus.yml` — self-scrape + placeholder targets for `apps/api:3000` and `apps/ai-service:8001` (via `host.docker.internal`) — marked down until those apps exist in later prompts.
- `infra/grafana/provisioning/datasources/datasources.yml` — Prometheus (default) + Jaeger datasources.
- `infra/grafana/provisioning/dashboards/dashboards.yml` — provider pointing at `./json/` folder (`.gitkeep` placeholder; real dashboards land in `[III.15.7]`).
- `infra/README.md` — service table, commands, first-boot notes, extension-verification command.

**Files created** (8 new)

- `infra/docker-compose.yml`
- `infra/postgres/Dockerfile`
- `infra/postgres/init/01-extensions.sql`
- `infra/prometheus/prometheus.yml`
- `infra/grafana/provisioning/datasources/datasources.yml`
- `infra/grafana/provisioning/dashboards/dashboards.yml`
- `infra/grafana/provisioning/dashboards/json/.gitkeep`
- `infra/README.md`

**Files edited** — `PROGRESS.md` (this entry).

**Dependencies added** — none at the Node/pnpm layer. 8 Docker images pulled + 1 local image built.

**Commands run**

1. `docker compose -f infra/docker-compose.yml up -d` — initial: Jaeger tag `1.62` invalid, fixed to `1.65.0`, retried. Pulled 8 images, built postgres image (~2 min on first run).
2. `docker compose -f infra/docker-compose.yml ps` — 7/8 healthy after ~53s; meilisearch stuck on `(health: starting)`.
3. Diagnosed meilisearch: image _has_ `wget` at `/usr/bin/wget` and listens on `0.0.0.0:7700`, but `wget -q --spider http://localhost:7700/health` reliably returns "connection refused" inside the container (even with `127.0.0.1`); likely a busybox-applet quirk. `curl` works fine. Switched healthcheck to `curl -fs http://localhost:7700/health` and recreated the container — healthy in ~27s.
4. `docker compose ps` — **all 8 services healthy**.
5. `docker compose exec postgres psql -c "\dx"` — lists `pg_trgm 1.6 / pgcrypto 1.3 / plpgsql / postgis 3.4.3 / postgis_topology 3.4.3 / vector 0.8.2` (6 rows).
6. Host-side smoke test (curl each exposed port): meilisearch/minio/mailpit/jaeger/prometheus/grafana all HTTP 200; postgres + redis as expected don't speak HTTP.
7. Composite functional query exercising all 4 domain extensions at once:
   ```sql
   SELECT ST_AsText(ST_MakePoint(77.5946, 12.9716)::geography),
          (ARRAY[0.1,0.2,0.3]::vector(3)) <-> (ARRAY[0.4,0.5,0.6]::vector(3)),
          similarity('Bengaluru', 'Bangalore'),
          encode(digest('travel', 'sha256'), 'hex');
   ```
   Returns:
   - `POINT(77.5946 12.9716)` (PostGIS),
   - `0.5196152525944904` (pgvector L2 distance),
   - `0.1764706` (pg_trgm similarity),
   - `0209442e...c461c4` (pgcrypto SHA-256).

**Verification**

- ✅ `docker compose ps` — 8/8 services `Up (healthy)` within 60s on a warm start (first boot ~2 min including image pulls + postgres build).
- ✅ Postgres extensions installed **and** functionally exercised (spatial + vector + trigram + crypto).
- ✅ Grafana UI reachable on `:3001`; Prometheus on `:9090`; Jaeger UI on `:16686`; MinIO console on `:9001`; Mailpit UI on `:8025`; Meilisearch on `:7700`.
- ✅ Grafana datasources auto-provisioned (Prometheus + Jaeger visible at first login with `admin/admin`).

**Acceptance criteria (from prompt)**

- ✅ `docker compose ps` shows all services healthy within 60s on warm start.

**Notes / deviations**

- Jaeger tag corrected `1.62` → `1.65.0` (Docker Hub doesn't carry `1.62` without patch suffix; all current 1.x tags are `X.Y.Z`).
- Meilisearch healthcheck swapped from `wget` to `curl` to work around the busybox `wget --spider` quirk in its v1.11 image. Functionality unchanged.
- `.husky/commit-msg` uses `[no-install]` style: calls `commitlint` directly via `node_modules/.bin`. On commit, `lint-staged` may prettify `infra/*.yml` — expected.
- `host.docker.internal` used for Prometheus targets pointing at future API/ai-service — those report `down` until those apps exist; harmless noise.
- A root `Makefile` with `make up / down / logs / reset / db-shell / redis-shell` is intentionally deferred to prompt **[IX.32.3]**.
- `.env.example` covering required env vars is deferred to prompt **[IX.32.4]** + shared-types env schema prompt **[III.11.1]**.

**Next prompt candidates**

- `[IX.32.3]` — Root Makefile + compose wrappers (tiny, 1 file).
- `[IV.18.1.11]` — GitHub Actions CI/CD pipeline (unlocks automatic verification on push).
- `[IV.17.6]` — Path aliases + instrumentation.ts scaffold (tiny cleanup).
- `[III.11.1]` — `@app/config` package (first real TS code; Zod env schema).
- `[II.6.2]`–`[II.6.4]` — Architecture ADRs (pure docs, locks decisions).

---

### [II.10.0] — Monorepo scaffold (Turborepo + pnpm + shared configs)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 10

**What was done**

- **Root toolchain**: `package.json` with `packageManager: pnpm@9.12.3`, scripts for dev/build/lint/typecheck/test/format, devDeps (turbo 2.9, typescript 5.9, eslint 9.39, prettier 3.8, husky 9.1, lint-staged 15.5, commitlint 19.8). `pnpm-workspace.yaml` covers `apps/*` + `packages/*`, excludes `apps/ai-service` (Python).
- **Turbo pipelines**: `turbo.json` with tasks `build / dev / lint / typecheck / test / test:integration / db:generate / db:migrate`. Proper `dependsOn ["^build"]` chain + cache rules per Playbook [IV.18.1.11].
- **Config files**: `.nvmrc` (Node 22), `.npmrc` (auto-install-peers, save-exact, engine-strict), `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js` (conventional + `scope-case:[0]` to allow `(II.10.0)` style scopes).
- **Husky v9 hooks**: `.husky/pre-commit` → `pnpm exec lint-staged`, `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`. `.husky/_/` (auto-generated helpers) added to `.gitignore`. Husky's `prepare` script ran during install and wired `core.hooksPath=.husky/_`.
- **GitHub**: `.github/pull_request_template.md` enforcing prompt-id, acceptance criteria, verification output, CLAUDE.md checklist.
- **README.md**: quickstart + structure + commands + link to Playbook/prompts/CLAUDE.
- **Shared packages** (real, not placeholder):
  - `packages/tsconfig` — `base.json` (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess) + `nestjs.json` (decorators, CJS) + `nextjs.json` (jsx preserve, next plugin) + `react-native.json` (jsx react-native).
  - `packages/eslint-config` — flat config using `typescript-eslint` v8 + `globals`. Rules: `no-explicit-any: error`, `no-console` (allow warn/error), `no-unused-vars` (allow `_`-prefixed), `eqeqeq: always`.
- **Placeholder apps** (7 × 2 files): `api`, `web`, `admin`, `mobile`, `media-service`, `notification-worker`, `crawler-worker` — each with minimal `package.json` + `src/index.ts` noting which prompt will fill it.
- **Placeholder packages** (8 × 2 files): `@app/shared-types`, `@app/ui`, `@app/mobile-ui`, `@app/sdk`, `@app/logger`, `@app/config`, `@app/errors`, `@app/observability` — each with minimal `package.json` (type module, main/types pointing at src/index.ts) + placeholder `src/index.ts`.
- **Python sidecar**: `apps/ai-service/README.md` noting it's excluded from pnpm-workspace; real Python scaffold lands in `[IV.18.2.11]`.
- **CLAUDE.md updated**: commit-message format clarified to `<type>(<prompt-id>): <subject>` (conventional + scope=prompt-id) with valid types enumerated.

**Files created** — ~50 total:

- Root (12): `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.npmrc`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js`, `README.md`, `.husky/pre-commit`, `.husky/commit-msg`.
- `.github/pull_request_template.md`
- `packages/tsconfig/` — `package.json`, `base.json`, `nestjs.json`, `nextjs.json`, `react-native.json` (5).
- `packages/eslint-config/` — `package.json`, `index.js` (2).
- Apps (15): `{api,web,admin,mobile,media-service,notification-worker,crawler-worker}/{package.json,src/index.ts}` + `ai-service/README.md`.
- Packages (16): `{shared-types,ui,mobile-ui,sdk,logger,config,errors,observability}/{package.json,src/index.ts}`.
- `pnpm-lock.yaml` (auto-generated by pnpm install).

**Files edited**

- `.gitignore` — added `.husky/_/`.
- `CLAUDE.md` — commit-message format rule updated to conventional commits.

**Dependencies added** (root devDeps):

- `turbo@^2.3.3` (resolved 2.9.6)
- `typescript@^5.7.2` (5.9.3)
- `eslint@^9.17.0` (9.39.4)
- `prettier@^3.4.2` (3.8.3)
- `husky@^9.1.7` (9.1.7)
- `lint-staged@^15.2.11` (15.5.2)
- `@commitlint/cli@^19.6.1` (19.8.1)
- `@commitlint/config-conventional@^19.6.0` (19.8.1)
- In `@app/eslint-config`: `typescript-eslint@^8.18.2`, `globals@^15.14.0`.
- Total 247 packages resolved in 18.2s.

**Commands run**

1. `corepack enable pnpm` — failed (admin required on Windows). Fallback: use `npx pnpm@9.12.3`.
2. `npx pnpm@9.12.3 install` — 247 packages, 18 workspace projects, husky prepare ran.
3. `npx pnpm turbo run typecheck lint` — 0 tasks matched (placeholders have no scripts yet), exit 0.
4. `echo "bad msg" | npx pnpm exec commitlint` — exit 1, rejected (✅ expected).
5. `echo "chore(II.10.0): ..." | npx pnpm exec commitlint` — exit 0, accepted (✅ expected).

**Verification**

- ✅ `pnpm install` succeeds (18.2s, 247 packages).
- ✅ `pnpm turbo run typecheck lint` green on empty placeholders (0 tasks, exit 0).
- ✅ Committing with a non-conventional message fails commitlint (2 errors: type-empty, subject-empty).
- ✅ Husky pre-commit is wired (`.husky/pre-commit` calls `lint-staged`; `core.hooksPath=.husky/_`).

**Acceptance criteria (from prompt)**

- ✅ `pnpm install` succeeds.
- ✅ `pnpm turbo run lint typecheck` green on empty placeholders.
- ✅ Committing with a non-conventional message fails commitlint.
- ✅ Husky pre-commit runs lint-staged.

**Notes / deviations**

- `corepack enable` needed admin on Windows; using `npx pnpm` as the invocation path. Documented in README quickstart. Future prompts: use `npx pnpm ...` or ask user to enable corepack once (admin prompt).
- Apps are placeholder-only — real NestJS/Next.js/Expo scaffolds land in `[III.11.x]` / `[IV.18.1.14.a-c]`.
- Packages `@app/ui`, `@app/mobile-ui`, `@app/sdk` are workspace-resolvable but export nothing yet.
- Did not add ESLint config or tsconfig.json per package placeholder — those land when each package gets its real code, keeping this scaffold prompt lean.

**Next prompt candidates**

- `[IV.17.6]` — wire `@app/*` path aliases in the shared tsconfig + root `tsconfig.json` (prereq for clean imports across packages).
- `[IV.18.1.7]` — testing infrastructure (Testcontainers + Jest + factories + MSW).
- `[IV.18.1.11]` — CI/CD GitHub Actions workflows.
- `[II.6.2]` / `[II.6.3]` / `[II.6.4]` — architecture ADRs.

---

### [IV.19.1] — Install System Rules + progress scaffolding

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 19.1

**What was done**

- Initialised the git repository on `main` (folder was not previously tracked).
- Added a root `.gitignore` covering Node/pnpm/Turbo, env files, editor, RN/Expo, Python, Prisma.
- Created `CLAUDE.md` at repo root with the full Part 0 System Rules from the prompt archive. This is auto-loaded by Claude Code and codifies the hard constraints, output format, self-check list, tool hints, and the per-prompt execution workflow this project is using.
- Created `docs/agent-contract.md` with the first acknowledgement entry so future seed prompts have a place to record agent agreements.
- Created this `PROGRESS.md` as the rolling execution log.

**Files created**

- `.gitignore`
- `CLAUDE.md`
- `docs/agent-contract.md`
- `PROGRESS.md`

**Files edited** — none.

**Dependencies added** — none (no code yet).

**Verification**

- `CLAUDE.md` exists at repo root with all 13 hard constraints.
- `docs/agent-contract.md` exists with the [IV.19.1] acknowledgement.
- `git status` clean after commit.

**Acceptance criteria (from prompt)**

- ✅ Claude Code reads the rules on every session start — CLAUDE.md present at repo root.
- ✅ `docs/agent-contract.md` collecting acknowledgements — created with first entry.

**Notes**

- No code artefacts yet — this is a docs/config prompt only, so no typecheck/lint/test retest was applicable.
- Next natural prompts to consider (pick one):
  - `[I.1.1]` — Context confirmation (seed, no code).
  - `[II.10.0]` — Monorepo scaffold (first real code; large).
  - `[IV.19.2]`/`[IV.19.3]`/`[IV.19.4]` — rest of the meta-layer (context-carry doc, end-prompt command, stop-hook).

**Commit** — see git log.
