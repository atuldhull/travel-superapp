# Engineer onboarding — TravelSuperApp

> Installed by prompt `[IV.18.19.9]`. Goal (per playbook §13):
> get a new engineer productive in **one day**.
>
> If anything in this doc is wrong, fix it in the same PR as your
> first feature. New-engineer feedback IS the canonical signal that
> onboarding has drifted.

## TL;DR — first-day path

1. [Prereqs](#prereqs) (15 min)
2. [Clone + install](#clone--install) (10 min)
3. [Boot the local stack](#boot-the-local-stack) (10 min)
4. [Apply migrations + seed demo data](#apply-migrations--seed-demo-data) (5 min)
5. [Run the API + verify health](#run-the-api--verify-health) (5 min)
6. [Run the integration suite](#run-the-integration-suite) (10 min)
7. [Read the canonical docs](#read-the-canonical-docs) (60 min)
8. [Open your first PR](#open-your-first-pr) (rest of the day)

Total: ~2 hours of setup + 1 hour of reading + the rest of the day on a real change.

## Prereqs

- **Node 22+** — see `.nvmrc`. `nvm use` works.
- **pnpm 9+** — `corepack enable` is the simplest path (`package.json#packageManager` pins `pnpm@9.12.3`).
- **Docker Desktop** (or Linux Docker engine + compose plugin).
- **Git**, configured with your name + the email under which you'll commit.
- **Doppler CLI** — see [`docs/runbooks/secrets.md`](./runbooks/secrets.md) for the bootstrap. Optional for first hour; required before running tests against real secrets.

## Clone + install

```sh
git clone <repo-url> travel-superapp
cd travel-superapp

# Install workspace deps. Should complete cleanly.
pnpm install
```

If `pnpm install` fails, the most common cause is mismatched Node versions. `node --version` should print `v22.x.x`.

## Boot the local stack

```sh
docker compose -f infra/docker-compose.yml up -d

# Verify all services healthy.
docker compose -f infra/docker-compose.yml ps
```

Expected services (from [`infra/docker-compose.yml`](../infra/docker-compose.yml)):

- `travel-postgres` — Postgres 16 + PostGIS 3.4 + pgvector
- `travel-redis` — Redis 7 (cache / rate limits / sessions / streams)
- `travel-meilisearch` — typo-tolerant full-text search
- `travel-minio` — S3-compatible object storage
- `travel-mailpit` — local SMTP (Web UI on :8025)
- `travel-prometheus` + `travel-grafana` + `travel-jaeger` — observability stack

If any container is `unhealthy`, check `docker logs <container>`. Postgres + MinIO need ~30s to settle on first boot.

## Apply migrations + seed demo data

```sh
# Generate the Prisma client + apply migrations to the dev DB.
pnpm --filter=api db:generate
pnpm --filter=api db:migrate:deploy

# Seed two demo users + 6 trips + 2 published memory books + 6 reviews.
pnpm --filter=api db:seed:demo
```

The seed script ([`apps/api/scripts/seed-demo.ts`](../apps/api/scripts/seed-demo.ts)) calls the real HTTP surface in-process so seeded rows exercise every gate (auth, ownership, validation) — a natural smoke test that the build is healthy.

⚠️ The seed script is **not idempotent**. Re-running doubles the data. For a clean demo, drop + re-migrate the dev DB.

## Run the API + verify health

```sh
# In one terminal:
pnpm --filter=api dev

# In another:
curl -fs localhost:3000/health/live
curl -fs localhost:3000/health/ready
curl -fs localhost:3000/metrics | head -20
```

Healthy response = the API is up. The `/metrics` output should include `cache_hit_total`, `cache_miss_total`, `http_request_duration_seconds`, `domain_events_total`, and the default Node process metrics.

Open the seeded discovery surface:

```sh
curl -fs localhost:3000/api/v1/memory-books/featured | jq
```

You should see two published memory books from the demo seed.

## Run the integration suite

```sh
# Full suite (~45s on a warm laptop).
pnpm --filter=api test
```

Expected: **93 suites, 578 tests passing**. If the first run hits a flake, re-run once. If a real failure persists, that's a regression — open a triage issue before working around it.

## Read the canonical docs

Read in this order. Total ~60 min for an experienced engineer.

| Order | File                                                                                    | What you learn                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`README.md`](../README.md)                                                             | Repo layout + quickstart (already done above).                                                                                           |
| 2     | [`CLAUDE.md`](../CLAUDE.md)                                                             | The 13 hard constraints every change must respect. Most-violated: rule 8 (schema is append-only) and rule 11 (PostGIS via `GeoQueries`). |
| 3     | [`travel-app-playbook.md`](../travel-app-playbook.md) §1–4                              | Why modular monolith, the bounded contexts, the architecture diagram.                                                                    |
| 4     | [ADR-001 — Modular monolith](./adr/ADR-001-modular-monolith.md)                         | The first architectural decision; everything else hangs off this.                                                                        |
| 5     | [ADR-004 — Bounded contexts](./adr/ADR-004-bounded-contexts.md)                         | The 17 modules + their isolation rules.                                                                                                  |
| 6     | [ADR-012 — updateMany pattern](./adr/ADR-012-owner-scoped-updatemany-pattern.md)        | The IDOR-safe write shape used in 30+ adapter methods. Read this before writing your first mutation.                                     |
| 7     | [ADR-013 — Section graceful degradation](./adr/ADR-013-section-graceful-degradation.md) | Composite endpoints' contract — the dashboard never 500s.                                                                                |
| 8     | [ADR-014 — Admin in owning module](./adr/ADR-014-admin-in-owning-module.md)             | Where to put admin verbs (NOT in AdminModule).                                                                                           |
| 9     | [`docs/runbooks/secrets.md`](./runbooks/secrets.md)                                     | Doppler workflow + rotation cadence.                                                                                                     |
| 10    | [`docs/runbooks/env-reference.md`](./runbooks/env-reference.md)                         | Every env var: required-vs-optional + what-it-does.                                                                                      |
| 11    | [`PROGRESS.md`](../PROGRESS.md) (last 10 entries)                                       | What's been built recently + the open work.                                                                                              |

## Open your first PR

A reasonable first task is to fix something that bothers you in the docs you just read. Examples:

- A broken link in a runbook.
- A typo in an ADR.
- A missing entry in the env reference (compare against [`packages/config/src/schema.ts`](../packages/config/src/schema.ts)).
- An onboarding-doc step that didn't work for you — fix it for the next person.

### PR checklist

- [ ] Branch off `main` (`git checkout -b <type>/<short-description>`).
- [ ] Make the smallest change that achieves the goal.
- [ ] Run `pnpm turbo run lint typecheck` locally; fix anything red.
- [ ] Run `pnpm --filter=api test` if you touched `apps/api/`.
- [ ] Conventional-commit message (`feat(IV.18.x.x): ...`, `fix(IV.18.x.x): ...`, `docs(...): ...`). The `commitlint.config.js` enforces the prefix.
- [ ] Open the PR. CI will run `phase-0-smoke.yml` + `ci.yml` + `security.yml`. Fix any red gates.
- [ ] Land it.

## Common gotchas

- **`pnpm install` succeeds but `tsc --noEmit` fails on missing `@prisma/client`.** Run `pnpm --filter=api db:generate`.
- **Tests skip with "DB not reachable".** `docker compose ps` — make sure Postgres + Redis + MinIO are all `healthy`. If MinIO is `starting` after 60s, restart it: `docker compose restart minio`.
- **PostGIS test failures with cryptic "no PostGIS extension".** You used the wrong Postgres image. `docker-compose.yml` builds from `./postgres/Dockerfile` which adds PostGIS + pgvector — make sure you didn't override the image.
- **Background scheduler keeps Jest from exiting.** Set `NODE_ENV=test` in your shell — the schedulers skip themselves under test mode.
- **Prisma `$queryRaw` boolean filter weirdness.** See `memory/feedback_prisma_raw_boolean.md` (this file is project-team folklore — branch the query, don't conditional-filter via `::boolean`).

## Where to ask for help

- **Architectural questions:** read the relevant ADR first; if it's still unclear, the ADR's "Open" section often calls out exactly the question you're asking.
- **"Where do I put X?":** check the playbook's bounded-context map (`travel-app-playbook.md` §3.1).
- **"Is this allowed by CLAUDE.md?":** re-read the 13 hard constraints. If genuinely ambiguous, the answer is "no, ask first".
- **"How does Y work?":** the prompt-archive (`travel-app-prompts.md`) has the original spec for every shipped feature; PROGRESS.md has the rolling log of what changed.

## Beyond day one

- **Day 2:** ship a real bug fix or small feature touching 2-3 files.
- **Week 1:** ship a feature that crosses a module boundary (read another module's port).
- **Week 2:** ship something that adds a new ADR-worthy decision — and write the ADR for it.
